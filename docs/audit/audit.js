(function () {
  "use strict";
  function analyzeWorkflow(workflow) {
    var result = {
      name: "", totalNodes: 0, enabledNodes: 0, disabledNodes: 0,
      triggerNodes: 0, webhookNodes: 0, httpRequestNodes: 0, codeNodes: 0,
      credentialCount: 0, credentialTypes: [], expressionCount: 0,
      connectionCount: 0, hasRespondToWebhook: false,
      hasHttpUrls: 0, hasHttpsUrls: 0, warnings: [], sensitiveKeyWarning: false
    };
    if (!workflow || typeof workflow !== "object") {
      result.warnings.push("No valid workflow object detected.");
      return result;
    }
    if (workflow.name) result.name = String(workflow.name);
    var nodes = workflow.nodes;
    if (!Array.isArray(nodes)) {
      result.warnings.push("No nodes array found in workflow.");
      return result;
    }
    result.totalNodes = nodes.length;
    if (result.totalNodes === 0) { result.warnings.push("No nodes found."); }
    var triggerTypes = ["trigger", "webhook", "cron", "schedule"];
    var hasTrigger = false;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (!node || typeof node !== "object") continue;
      var type = (node.type || "").toLowerCase();
      var disabled = !!node.disabled;
      if (disabled) { result.disabledNodes++; } else { result.enabledNodes++; }
      var isTrigger = false;
      for (var t = 0; t < triggerTypes.length; t++) {
        if (type.indexOf(triggerTypes[t]) !== -1) { isTrigger = true; break; }
      }
      if (isTrigger) { result.triggerNodes++; hasTrigger = true; }
      if (type.indexOf("webhook") !== -1) { result.webhookNodes++; }
      if (type.indexOf("respondtowebhook") !== -1 || type.indexOf("respond to webhook") !== -1) {
        result.hasRespondToWebhook = true;
      }
      if (type.indexOf("httprequest") !== -1 || type.indexOf("http request") !== -1) {
        result.httpRequestNodes++;
      }
      if (type.indexOf("code") !== -1 || type.indexOf("function") !== -1) {
        result.codeNodes++;
      }
      var creds = node.credentials;
      if (creds && typeof creds === "object") {
        var credKeys = Object.keys(creds);
        for (var c = 0; c < credKeys.length; c++) {
          var credObj = creds[credKeys[c]];
          if (credObj && credObj.id) {
            result.credentialCount++;
            var credType = credKeys[c];
            if (result.credentialTypes.indexOf(credType) === -1) {
              result.credentialTypes.push(credType);
            }
          }
        }
      }
      scanObject(node.parameters || {}, result, 0);
    }
    if (workflow.connections && typeof workflow.connections === "object") {
      var connKeys = Object.keys(workflow.connections);
      for (var ci = 0; ci < connKeys.length; ci++) {
        var tc = workflow.connections[connKeys[ci]];
        if (Array.isArray(tc)) { result.connectionCount += tc.length; }
        else if (typeof tc === "object") {
          var subKeys = Object.keys(tc);
          for (var si = 0; si < subKeys.length; si++) {
            var subArr = tc[subKeys[si]];
            if (Array.isArray(subArr)) { result.connectionCount += subArr.length; }
          }
        }
      }
    }
    if (!hasTrigger && result.totalNodes > 0) {
      result.warnings.push("No obvious trigger/webhook/schedule node detected.");
    }
    if (result.disabledNodes > 0) {
      result.warnings.push("Workflow contains disabled nodes.");
    }
    if (result.credentialCount > 0) {
      result.warnings.push("Workflow references credential objects; verify credentials are configured after import.");
    }
    if (result.httpRequestNodes > 0) {
      result.warnings.push("Workflow contains HTTP Request nodes; external endpoints may affect runtime behavior.");
    }
    if (result.codeNodes > 0) {
      result.warnings.push("Workflow contains Code/Function nodes; review custom code before production use.");
    }
    if (result.hasHttpUrls > 0) {
      result.warnings.push("Workflow contains plain http:// URL references.");
    }
    if (result.webhookNodes > 0 && !result.hasRespondToWebhook) {
      result.warnings.push("Workflow appears to have a webhook trigger but no obvious Respond to Webhook node.");
    }
    if (result.expressionCount > 5) {
      result.warnings.push("Workflow contains many expressions; runtime values should be tested in n8n.");
    }
    if (result.sensitiveKeyWarning) {
      result.warnings.push("Potential sensitive-value field names detected. Review the workflow before sharing it publicly.");
    }
    return result;
  }
  function scanObject(obj, result, depth) {
    if (!obj || typeof obj !== "object" || depth > 20) return;
    if (Array.isArray(obj)) {
      for (var ai = 0; ai < obj.length; ai++) { scanObject(obj[ai], result, depth + 1); }
      return;
    }
    var keys = Object.keys(obj);
    for (var ki = 0; ki < keys.length; ki++) {
      var key = keys[ki], val = obj[key];
      var keyLower = String(key).toLowerCase();
      var sensitiveTerms = ["password", "secret", "token", "apikey", "api_key", "authorization"];
      for (var st = 0; st < sensitiveTerms.length; st++) {
        if (keyLower.indexOf(sensitiveTerms[st]) !== -1) { result.sensitiveKeyWarning = true; break; }
      }
      if (typeof val === "string") {
        if (val.indexOf("{{") !== -1 && val.indexOf("}}") !== -1) { result.expressionCount++; }
        if (val.indexOf("http://") !== -1) { result.hasHttpUrls++; }
        if (val.indexOf("https://") !== -1) { result.hasHttpsUrls++; }
      } else if (typeof val === "object") {
        scanObject(val, result, depth + 1);
      }
    }
  }

  /* ---- Privacy-safe issue summary builder ---- */
  function buildSafeIssueSummary(s) {
    var lines = [];
    lines.push("n8n Workflow JSON Quick Check summary");
    lines.push("");
    lines.push("Generated locally in the browser by:");
    lines.push("https://weissalexey.github.io/aw-n8n-workflow-help/audit/");
    lines.push("");
    lines.push("Structural counts");
    lines.push("Total nodes: " + s.totalNodes);
    lines.push("Enabled nodes: " + s.enabledNodes);
    lines.push("Disabled nodes: " + s.disabledNodes);
    lines.push("Trigger-like nodes: " + s.triggerNodes);
    lines.push("Webhook nodes: " + s.webhookNodes);
    lines.push("HTTP Request nodes: " + s.httpRequestNodes);
    lines.push("Code / Function nodes: " + s.codeNodes);
    lines.push("Credential references: " + s.credentialCount);
    lines.push("Expression-like values: " + s.expressionCount);
    lines.push("Connections: " + s.connectionCount);
    lines.push("Respond to Webhook detected: " + (s.hasRespondToWebhook ? "Yes" : "No"));
    lines.push("");
    lines.push("Credential types referenced");
    if (s.credentialTypes && s.credentialTypes.length > 0) {
      var sorted = s.credentialTypes.slice().sort();
      for (var ci = 0; ci < sorted.length; ci++) {
        lines.push(sorted[ci]);
      }
    } else {
      lines.push("None detected");
    }
    lines.push("");
    lines.push("Structural warnings");
    if (s.warnings && s.warnings.length > 0) {
      for (var wi = 0; wi < s.warnings.length; wi++) {
        lines.push(s.warnings[wi]);
      }
    } else {
      lines.push("No structural warnings generated by the quick check.");
    }
    lines.push("");
    lines.push("What I need help with");
    lines.push("");
    lines.push("Please describe the actual problem, expected behavior, and what happens when you run/import the workflow.");
    lines.push("");
    lines.push("Do not paste credentials, tokens, passwords, confidential customer data, or other secrets into this public issue.");
    lines.push("");
    lines.push("This diagnostic is a static structural review only and is not a live n8n runtime/import validation.");
    lines.push("");
    lines.push("END SUMMARY");
    return lines.join(String.fromCharCode(10));
  }

  /* ---- Privacy-safe GitHub issue URL builder ---- */
  function buildWorkflowHelpIssueUrl(s) {
    var safeBody = buildSafeIssueSummary(s);
    var baseUrl = "https://github.com/weissalexey/aw-n8n-workflow-help/issues/new";
    var params = new URLSearchParams();
    params.set("template", "workflow-fix.md");
    params.set("title", "n8n workflow diagnostic help");
    params.set("body", safeBody);
    return baseUrl + "?" + params.toString();
  }
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    (function () {
      var fileInput, textarea, analyzeBtn, clearBtn, resultsDiv;
      function init() {
        fileInput = document.getElementById("workflow-file");
        textarea = document.getElementById("workflow-text");
        analyzeBtn = document.getElementById("analyze-btn");
        clearBtn = document.getElementById("clear-btn");
        resultsDiv = document.getElementById("results");
        if (fileInput) fileInput.addEventListener("change", handleFile);
        if (analyzeBtn) analyzeBtn.addEventListener("click", handleAnalyze);
        if (clearBtn) clearBtn.addEventListener("click", handleClear);
      }
      function handleFile(e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) { textarea.value = ev.target.result; };
        reader.readAsText(file);
      }
      function handleAnalyze() {
        var raw = textarea.value.trim();
        if (!raw) {
          resultsDiv.innerHTML = "<div class='audit-card'><p>Please load or paste a workflow JSON file first.</p></div>";
          return;
        }
        var workflow;
        try { workflow = JSON.parse(raw); }
        catch (err) {
          resultsDiv.innerHTML = "<div class='audit-card'><p><strong>Invalid JSON:</strong> " + esc(err.message) + "</p></div>";
          return;
        }
        var summary = analyzeWorkflow(workflow);
        renderResults(summary);
      }
      function handleClear() {
        textarea.value = "";
        if (fileInput) fileInput.value = "";
        resultsDiv.innerHTML = "";
      }
      function renderResults(s) {
        var h = "";
        h += "<div class='audit-card'><h3>Workflow Summary</h3><table class='audit-table'>";

        h += r("Total nodes", s.totalNodes);
        h += r("Enabled nodes", s.enabledNodes);
        h += r("Disabled nodes", s.disabledNodes);
        h += r("Connections", s.connectionCount);
        h += "</table></div>";
        h += "<div class='audit-card'><h3>Node Types Detected</h3><table class='audit-table'>";
        h += r("Trigger-like nodes", s.triggerNodes);
        h += r("Webhook nodes", s.webhookNodes);
        h += r("HTTP Request nodes", s.httpRequestNodes);
        h += r("Code/Function nodes", s.codeNodes);
        h += r("Respond to Webhook present", s.hasRespondToWebhook ? "Yes" : "No");
        h += r("Plain http:// URLs", s.hasHttpUrls);
        h += r("https:// URLs", s.hasHttpsUrls);
        h += r("Expression-like values", s.expressionCount);
        h += "</table></div>";
        h += "<div class='audit-card'><h3>Credentials References</h3>";
        h += "<p>Total credential references: " + s.credentialCount + "</p>";
        if (s.credentialTypes.length > 0) {
          h += "<p>Types: " + esc(s.credentialTypes.join(", ")) + "</p>";
        } else { h += "<p>No credential references detected.</p>"; }
        h += "</div>";
        h += "<div class='audit-card'><h3>Structural Warnings</h3>";
        if (s.warnings.length === 0) { h += "<p>No structural warnings detected.</p>"; }
        else { h += "<ul>"; for (var wi = 0; wi < s.warnings.length; wi++) { h += "<li>" + esc(s.warnings[wi]) + "</li>"; } h += "</ul>"; }
        h += "</div>";
        h += "<div class='audit-card'><h3>Privacy Reminder</h3>";
        h += "<p>Your workflow JSON was analyzed entirely in your browser. Nothing was uploaded.</p>";
        h += "<p>Before sharing a workflow publicly, remove credentials, tokens, customer data, and other confidential values.</p>";
        h += "</div>";
        h += "<div class='audit-card'><h3>Export</h3>";
        h += "<button id='download-btn' class='download-btn'>Download summary</button>";
        h += "</div>";
        /* Conversion button */
        var issueUrl = buildWorkflowHelpIssueUrl(s);
        h += "<div class='audit-card' style='background:#f0f9ff;border-color:#bae6fd;'>";
        h += "<h3>Request help with this diagnostic</h3>";
        h += "<p style='font-size:0.85rem;color:#444;'>This opens a GitHub issue with a privacy-safe structural summary only. Review it before submitting and add the actual workflow problem yourself.</p>";
        h += "<p style='font-size:0.85rem;color:#b91c1c;font-weight:600;'>Do not add credentials, tokens, passwords, or confidential customer data to the public issue.</p>";
        h += "<a id='help-issue-link' href='" + esc(issueUrl) + "' target='_blank' rel='noopener noreferrer' style='display:inline-block;padding:0.5rem 1.2rem;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;font-size:0.9rem;'>Request help with this diagnostic</a>";
        h += "</div>";
        resultsDiv.innerHTML = h;
        var dlBtn = document.getElementById("download-btn");
        if (dlBtn) { dlBtn.addEventListener("click", function () { downloadSummary(s); }); }
      }
      function downloadSummary(s) {
        var lines2 = [];
        lines2.push("n8n Workflow JSON Quick Check - Diagnostic Summary");
        lines2.push("Generated locally in browser");
        lines2.push("");

        lines2.push("Total nodes: " + s.totalNodes);
        lines2.push("Enabled: " + s.enabledNodes);
        lines2.push("Disabled: " + s.disabledNodes);
        lines2.push("Connections: " + s.connectionCount);
        lines2.push("Trigger-like nodes: " + s.triggerNodes);
        lines2.push("Webhook nodes: " + s.webhookNodes);
        lines2.push("HTTP Request nodes: " + s.httpRequestNodes);
        lines2.push("Code/Function nodes: " + s.codeNodes);
        lines2.push("Respond to Webhook: " + (s.hasRespondToWebhook ? "Yes" : "No"));
        lines2.push("Credential references: " + s.credentialCount);
        if (s.credentialTypes.length > 0) { lines2.push("Credential types: " + s.credentialTypes.join(", ")); }
        lines2.push("Expression-like values: " + s.expressionCount);
        lines2.push("Plain http:// URLs: " + s.hasHttpUrls);
        lines2.push("https:// URLs: " + s.hasHttpsUrls);
        lines2.push("");
        lines2.push("Warnings:");
        if (s.warnings.length === 0) { lines2.push("  (none)"); }
        else { for (var wi = 0; wi < s.warnings.length; wi++) { lines2.push("  - " + s.warnings[wi]); } }
        lines2.push("");
        lines2.push("This summary does not contain raw workflow JSON or credential values.");
        var blob = new Blob([lines2.join(String.fromCharCode(10))], { type: "text/plain" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url; a.download = "n8n-workflow-check-summary.txt";
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      function r(label, value) {
        return "<tr><td>" + esc(String(label)) + "</td><td>" + esc(String(value)) + "</td></tr>";
      }
      function esc(str) {
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
      }
      if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); }
      else { init(); }
    })();
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { analyzeWorkflow: analyzeWorkflow, buildSafeIssueSummary: buildSafeIssueSummary, buildWorkflowHelpIssueUrl: buildWorkflowHelpIssueUrl };
  }
})();