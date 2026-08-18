#!/usr/bin/env python3
# n8n Workflow Audit - static validation for exported n8n workflow JSON files.
#
# Usage:
#     python tools/n8n_workflow_audit.py --path 'workflows/*.json'
#     python tools/n8n_workflow_audit.py --path 'workflow.json' --strict

import argparse
import glob
import json
import os
import re
import sys
from pathlib import Path


SECRET_KEY_PATTERNS = [
    re.compile(r'password', re.IGNORECASE),
    re.compile(r'passwd', re.IGNORECASE),
    re.compile(r'secret', re.IGNORECASE),
    re.compile(r'apikey', re.IGNORECASE),
    re.compile(r'api_key', re.IGNORECASE),
    re.compile(r'accesstoken', re.IGNORECASE),
    re.compile(r'access_token', re.IGNORECASE),
    re.compile(r'privatekey', re.IGNORECASE),
    re.compile(r'private_key', re.IGNORECASE),
]

WINDOWS_PATH_RE = re.compile('^[A-Z]:\\\\')
UNIX_USER_PATH_RE = re.compile(r'^/(home|Users)/')
UNIX_TMP_PATH_RE = re.compile(r'^/tmp/')
LOCALHOST_RE = re.compile('(localhost|127\\.0\\.0\\.1)')


def _find_strings_in_obj(obj, _path=''):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from _find_strings_in_obj(v, f'{_path}.{k}' if _path else k)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _find_strings_in_obj(v, f'{_path}[{i}]')
    elif isinstance(obj, str):
        yield (_path, obj)


def _check_secret_keys(node_obj, node_name):
    warnings = []
    def _walk(obj, path):
        if isinstance(obj, dict):
            for k, v in obj.items():
                child_path = f'{path}.{k}' if path else k
                if isinstance(v, str) and v.strip():
                    for pat in SECRET_KEY_PATTERNS:
                        if pat.search(k):
                            warnings.append(
                                "potential literal secret in key '" + child_path +
                                "' (node: " + node_name + ")"
                            )
                            break
                elif isinstance(v, (dict, list)):
                    _walk(v, child_path)
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                if isinstance(v, (dict, list)):
                    _walk(v, f'{path}[{i}]')
    _walk(node_obj, '')
    return warnings


def _check_local_paths(node_obj, node_name):
    warnings = []
    for path, val in _find_strings_in_obj(node_obj):
        if WINDOWS_PATH_RE.search(val):
            warnings.append("hard-coded Windows path in '" + path + "' (node: " + node_name + ")")
        elif UNIX_USER_PATH_RE.search(val):
            warnings.append("hard-coded Unix user path in '" + path + "' (node: " + node_name + ")")
        elif UNIX_TMP_PATH_RE.search(val):
            warnings.append("hard-coded /tmp path in '" + path + "' (node: " + node_name + ")")
    return warnings


def _check_localhost(node_obj, node_name):
    warnings = []
    for path, val in _find_strings_in_obj(node_obj):
        if LOCALHOST_RE.search(val):
            warnings.append("localhost/127.0.0.1 reference in '" + path + "' (node: " + node_name + ")")
    return warnings


def _count_credential_refs(node_obj):
    count = 0
    if isinstance(node_obj, dict):
        creds = node_obj.get('credentials', {})
        if isinstance(creds, dict) and creds:
            count += len(creds)
    return count


def audit_workflow(filepath):
    errors = []
    warnings = []
    node_count = 0
    credential_refs = 0

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            raw = f.read()
    except Exception as e:
        errors.append('cannot read file: ' + str(e))
        return errors, warnings, node_count, credential_refs

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        errors.append('invalid JSON: ' + str(e))
        return errors, warnings, node_count, credential_refs

    if not isinstance(data, dict):
        errors.append('root is not a JSON object')
        return errors, warnings, node_count, credential_refs

    if 'nodes' not in data:
        errors.append("missing 'nodes' key")
    elif not isinstance(data['nodes'], list):
        errors.append("'nodes' is not a list")
    else:
        nodes = data['nodes']
        node_count = len(nodes)
        seen_names = {}
        for i, node in enumerate(nodes):
            if not isinstance(node, dict):
                errors.append('node[' + str(i) + '] is not an object')
                continue
            name = node.get('name', '')
            ntype = node.get('type', '')
            if not name or not isinstance(name, str) or not name.strip():
                errors.append("node[" + str(i) + "] has empty or missing 'name'")
            else:
                name = name.strip()
                if name in seen_names:
                    errors.append(
                        "duplicate node name '" + name + "' "
                        "(first at node[" + str(seen_names[name]) +
                        "], again at node[" + str(i) + "])")
                seen_names[name] = i
            if not ntype or not isinstance(ntype, str) or not ntype.strip():
                errors.append(
                    "node[" + str(i) + "] (name='" + name +
                    "') has empty or missing 'type'")
            warnings.extend(_check_secret_keys(node, name or 'node[' + str(i) + ']'))
            warnings.extend(_check_local_paths(node, name or 'node[' + str(i) + ']'))
            warnings.extend(_check_localhost(node, name or 'node[' + str(i) + ']'))
            credential_refs += _count_credential_refs(node)

    if 'connections' not in data:
        errors.append("missing 'connections' key")
    elif not isinstance(data['connections'], dict):
        errors.append("'connections' is not an object")
    else:
        all_node_names = set()
        if isinstance(data.get('nodes'), list):
            for node in data['nodes']:
                if isinstance(node, dict) and isinstance(node.get('name'), str):
                    all_node_names.add(node['name'].strip())
        for source_name, targets in data['connections'].items():
            if source_name not in all_node_names and all_node_names:
                errors.append(
                    "connection references non-existent source node '" + source_name + "'")
            if isinstance(targets, dict):
                for output_name, connections in targets.items():
                    if isinstance(connections, list):
                        for conn in connections:
                            if isinstance(conn, dict):
                                target = conn.get('node', '')
                                if target and target not in all_node_names and all_node_names:
                                    errors.append(
                                        "connection references non-existent target node '" +
                                        target + "' (from '" + source_name +
                                        "'->" + output_name + ")")
    return errors, warnings, node_count, credential_refs


def main():
    parser = argparse.ArgumentParser(
        description='Static audit for exported n8n workflow JSON files.'
    )
    parser.add_argument(
        '--path', required=True,
        help='Path to a workflow JSON file or a glob pattern'
    )
    parser.add_argument(
        '--strict', action='store_true', default=False,
        help='Exit with code 2 if warnings exist'
    )
    args = parser.parse_args()

    files = sorted(glob.glob(args.path))
    if not files:
        if os.path.isfile(args.path):
            files = [args.path]
        else:
            print("Error: no files matched '" + args.path + "'")
            sys.exit(3)

    total_errors = 0
    total_warnings = 0
    files_checked = 0
    files_passed = 0

    for filepath in files:
        errors, warnings, node_count, cred_refs = audit_workflow(filepath)
        files_checked += 1
        total_errors += len(errors)
        total_warnings += len(warnings)
        if not errors:
            files_passed += 1
        print('File: ' + filepath)
        print('  errors: ' + str(len(errors)))
        print('  warnings: ' + str(len(warnings)))
        print('  nodes: ' + str(node_count))
        print('  credential references: ' + str(cred_refs))
        for e in errors:
            print('  ERROR: ' + e)
        for w in warnings:
            print('  WARNING: ' + w)
        print()

    print('Summary: ' + str(files_checked) + ' file(s) checked, ' + str(files_passed) + ' passed')
    print('  total errors: ' + str(total_errors))
    print('  total warnings: ' + str(total_warnings))

    if total_errors > 0:
        sys.exit(1)
    if args.strict and total_warnings > 0:
        sys.exit(2)
    sys.exit(0)


if __name__ == '__main__':
    main()
