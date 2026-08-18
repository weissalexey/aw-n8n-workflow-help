import json
import os
import sys
import tempfile
import unittest

# Add tools directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))

from n8n_workflow_audit import audit_workflow


class TestAuditWorkflow(unittest.TestCase):

    def _write_json(self, data):
        fd, path = tempfile.mkstemp(suffix='.json')
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f)
        return path

    def _write_text(self, text):
        fd, path = tempfile.mkstemp(suffix='.json')
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(text)
        return path

    def test_valid_minimal_workflow(self):
        data = {
            'nodes': [
                {'name': 'Start', 'type': 'n8n-nodes-base.Start'}
            ],
            'connections': {}
        }
        path = self._write_json(data)
        try:
            errors, warnings, node_count, cred_refs = audit_workflow(path)
            self.assertEqual(len(errors), 0)
            self.assertEqual(node_count, 1)
            self.assertEqual(cred_refs, 0)
        finally:
            os.unlink(path)

    def test_invalid_json(self):
        path = self._write_text('{bad json')
        try:
            errors, warnings, node_count, cred_refs = audit_workflow(path)
            self.assertGreater(len(errors), 0)
            self.assertTrue(any('invalid JSON' in e for e in errors))
        finally:
            os.unlink(path)

    def test_missing_nodes(self):
        data = {'connections': {}}
        path = self._write_json(data)
        try:
            errors, warnings, node_count, cred_refs = audit_workflow(path)
            self.assertTrue(any('nodes' in e for e in errors))
        finally:
            os.unlink(path)

    def test_missing_connections(self):
        data = {'nodes': [{'name': 'A', 'type': 'X'}]}
        path = self._write_json(data)
        try:
            errors, warnings, node_count, cred_refs = audit_workflow(path)
            self.assertTrue(any('connections' in e for e in errors))
        finally:
            os.unlink(path)

    def test_duplicate_node_names(self):
        data = {
            'nodes': [
                {'name': 'NodeA', 'type': 'T1'},
                {'name': 'NodeA', 'type': 'T2'}
            ],
            'connections': {}
        }
        path = self._write_json(data)
        try:
            errors, warnings, node_count, cred_refs = audit_workflow(path)
            self.assertTrue(any('duplicate' in e for e in errors))
        finally:
            os.unlink(path)

    def test_dangling_connection(self):
        data = {
            'nodes': [
                {'name': 'NodeA', 'type': 'T1'}
            ],
            'connections': {
                'NodeA': {
                    'main': [{'node': 'NonExistent'}]
                }
            }
        }
        path = self._write_json(data)
        try:
            errors, warnings, node_count, cred_refs = audit_workflow(path)
            self.assertTrue(any('non-existent' in e for e in errors))
        finally:
            os.unlink(path)

    def test_localhost_warning(self):
        data = {
            'nodes': [
                {
                    'name': 'HTTP',
                    'type': 'n8n-nodes-base.HttpRequest',
                    'parameters': {'url': 'http://localhost:3000/api'}
                }
            ],
            'connections': {}
        }
        path = self._write_json(data)
        try:
            errors, warnings, node_count, cred_refs = audit_workflow(path)
            self.assertEqual(len(errors), 0)
            self.assertTrue(any('localhost' in w for w in warnings))
        finally:
            os.unlink(path)

    def test_local_path_warning(self):
        data = {
            'nodes': [
                {
                    'name': 'ReadFile',
                    'type': 'n8n-nodes-base.ReadWriteFiles',
                    'parameters': {'filePath': '/home/user/data.csv'}
                }
            ],
            'connections': {}
        }
        path = self._write_json(data)
        try:
            errors, warnings, node_count, cred_refs = audit_workflow(path)
            self.assertEqual(len(errors), 0)
            self.assertTrue(any('hard-coded' in w for w in warnings))
        finally:
            os.unlink(path)

    def test_secret_key_warning(self):
        data = {
            'nodes': [
                {
                    'name': 'API',
                    'type': 'n8n-nodes-base.HttpRequest',
                    'parameters': {'apiKey': 'sk-12345'}
                }
            ],
            'connections': {}
        }
        path = self._write_json(data)
        try:
            errors, warnings, node_count, cred_refs = audit_workflow(path)
            self.assertEqual(len(errors), 0)
            self.assertTrue(any('secret' in w for w in warnings))
            # Ensure the secret value is NOT in the warning
            for w in warnings:
                self.assertNotIn('sk-12345', w)
        finally:
            os.unlink(path)

    def test_credential_reference_not_error(self):
        data = {
            'nodes': [
                {
                    'name': 'GitHub',
                    'type': 'n8n-nodes-base.Github',
                    'credentials': {
                        'githubApi': {'id': 'abc123', 'mode': 'list'}
                    }
                }
            ],
            'connections': {}
        }
        path = self._write_json(data)
        try:
            errors, warnings, node_count, cred_refs = audit_workflow(path)
            self.assertEqual(len(errors), 0)
            self.assertEqual(cred_refs, 1)
        finally:
            os.unlink(path)

    def test_strict_mode_warnings(self):
        data = {
            'nodes': [
                {
                    'name': 'HTTP',
                    'type': 'n8n-nodes-base.HttpRequest',
                    'parameters': {'url': 'http://localhost:3000'}
                }
            ],
            'connections': {}
        }
        path = self._write_json(data)
        try:
            errors, warnings, node_count, cred_refs = audit_workflow(path)
            self.assertEqual(len(errors), 0)
            self.assertGreater(len(warnings), 0)
        finally:
            os.unlink(path)

    def test_no_file_match(self):
        import subprocess
        result = subprocess.run(
            [sys.executable, os.path.join(os.path.dirname(__file__), '..', 'tools', 'n8n_workflow_audit.py'),
             '--path', 'nonexistent_pattern_*.json'],
            capture_output=True, text=True
        )
        self.assertEqual(result.returncode, 3)


if __name__ == '__main__':
    unittest.main()
