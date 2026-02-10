# Manual Testing Guide - Antigravity Browser Extension

## Prerequisites
- ✅ Antigravity browser extension installed
- ✅ Development server running (`npm run dev`)
- ✅ Admin account credentials

---

## Test 1: Client Error Logging API

### Steps:
1. **Open Antigravity Extension**
2. **Navigate to**: `http://localhost:3000/test-error-logging`
3. **Expected**: Page loads with two test cards
4. **Action**: Click "Send Test Error" button
5. **Expected Result**: Success message with error ID
6. **Verification**: Check browser console - should see no errors

### Success Criteria:
- ✅ Page loads without errors
- ✅ Button click triggers API call
- ✅ Success message displays error ID
- ✅ Network tab shows 200 OK response to `/api/errors/client`

### What to Check:
- Response should be: `{ "success": true, "errorId": "uuid-here" }`
- No console errors
- Network request completes in <500ms

---

## Test 2: ErrorBoundary Integration

### Steps:
1. **Stay on**: `http://localhost:3000/test-error-logging`
2. **Action**: Click "Trigger Real Error" (red button)
3. **Expected**: ErrorBoundary catches error and displays error UI
4. **Verification**: 
   - Error UI should appear
   - Check Network tab for POST to `/api/errors/client`
   - Error should be logged automatically

### Success Criteria:
- ✅ ErrorBoundary displays fallback UI
- ✅ Error is automatically logged to server
- ✅ Network tab shows error POST request
- ✅ No unhandled errors in console

---

## Test 3: Admin Error Dashboard

### Steps:
1. **Login** as admin user
2. **Navigate to**: `http://localhost:3000/admin/client-errors`
3. **Expected**: Dashboard loads with error statistics

### What to Verify:
- ✅ **Stats Cards Display**:
  - Total Errors
  - Last Hour count
  - Unique URLs
  - Unique Users
  
- ✅ **Error List**:
  - Shows errors from Tests 1 & 2
  - Each error has severity badge
  - Timestamp is correct
  - URL is displayed

- ✅ **Detail Panel**:
  - Click an error in the list
  - Detail panel shows:
    - Full message
    - Stack trace
    - Component stack
    - URL
    - User info
    - Metadata

### Success Criteria:
- ✅ All UI components render correctly
- ✅ Errors from previous tests are visible
- ✅ Detail view shows complete error context
- ✅ Page loads in <3 seconds

---

## Test 4: CSV Export

### Steps:
1. **On Admin Dashboard**: `http://localhost:3000/admin/client-errors`
2. **Action**: Click "Export CSV" button
3. **Expected**: CSV file downloads

### Verification:
- ✅ File downloads immediately
- ✅ Filename: `client-errors-{timestamp}.csv`
- ✅ Open CSV and verify:
  - Header row present
  - Error data is correct
  - All fields populated

---

## Test 5: Error Alerting

### Steps:
1. **Navigate to**: `http://localhost:3000/test-error-logging`
2. **Action**: Click "Send Test Error" **15 times rapidly**
3. **Purpose**: Trigger alert threshold (≥10 errors)
4. **Verification**: 
   - Check admin notifications
   - Server console should show alert messages

### Expected Console Output:
```
[ErrorAlert:HIGH] Elevated error rate (X/min)
[ErrorAlertService] Generated 1 alerts
[ErrorAlert] Notifications sent to X admins
```

### Success Criteria:
- ✅ Alert generated after threshold met
- ✅ Admin notification created in database
- ✅ Console shows alert messages
- ✅ Notification appears in UI (if notification system enabled)

---

## Test 6: Rate Limiting

### Steps:
1. **Navigate to**: `http://localhost:3000/test-error-logging`
2. **Action**: Click "Send Test Error" **12 times rapidly**
3. **Expected**: After 10th click, rate limit error

### Verification:
- First 10 clicks: Success (200 OK)
- 11th and 12th clicks: Rate limited (429 Too Many Requests)
- Error message: "Too many error reports. Please try again later."

### Success Criteria:
- ✅ Rate limit triggers at 10 errors/minute
- ✅ 429 status code returned
- ✅ Error message is clear
- ✅ Rate limit resets after 1 minute

---

## Test 7: Browser Sandbox (If Enabled)

### Steps:
1. **Check** `.env` file for `ENABLE_BROWSER_SANDBOX=true`
2. **Navigate to**: Any page using browser automation
3. **Verification**: Check server console for sandbox messages

### Expected Console Output:
```
[BrowserSandbox] Launching browser (Sandbox: ENABLED)
[BrowserSandbox] Platform-specific guidance for your environment
```

### Success Criteria:
- ✅ Message confirms sandbox status
- ✅ Browser launches successfully
- ✅ Sandbox: ENABLED in production
- ✅ Sandbox: DISABLED in development (if configured)

---

## Test 8: MCP Transport (Requires External Server)

### Prerequisites:
- External MCP server running
- Server config in environment or code

### Steps:
1. **Start MCP Server** (e.g., `python mcp_server.py`)
2. **Trigger Agent Task** that uses MCP tools
3. **Verification**: Check server console

### Expected Console Output:
```
[StdioTransport] Spawning: python mcp_server.py
[StdioTransport] Connected successfully
[McpClient:server-id] Connected successfully with X tools
```

### Success Criteria:
- ✅ Transport connects to server
- ✅ Tools are discovered
- ✅ Tool calls execute successfully
- ✅ Responses are received

**Note**: Skip this test if no external MCP server is available

---

## Failure Reporting

If any test fails, document:

1. **Test Name**: Which test failed
2. **Step**: Which step failed
3. **Expected**: What should have happened
4. **Actual**: What actually happened
5. **Error Message**: Any console errors
6. **Network Tab**: HTTP status codes
7. **Screenshots**: Visual evidence

### Example Failure Report:
```
❌ Test 3: Admin Error Dashboard
   Step: Loading dashboard
   Expected: Dashboard loads with stats
   Actual: 404 Not Found
   Error: "Cannot GET /admin/client-errors"
   Network: 404 status code
   Screenshot: [attach screenshot]
```

---

## Success Checklist

Mark each test as you complete it:

- [ ] Test 1: Client Error Logging API
- [ ] Test 2: ErrorBoundary Integration
- [ ] Test 3: Admin Error Dashboard
- [ ] Test 4: CSV Export
- [ ] Test 5: Error Alerting
- [ ] Test 6: Rate Limiting
- [ ] Test 7: Browser Sandbox
- [ ] Test 8: MCP Transport (Optional)

---

## Post-Testing

After all tests:
1. Check database for ClientError records
2. Verify admin notifications exist
3. Review server logs for any errors
4. Confirm no memory leaks (if long-running)

---

## Quick Smoke Test (5 minutes)

If time is limited, run these critical tests only:
1. ✅ Load test page (`/test-error-logging`)
2. ✅ Send one error
3. ✅ View error in admin dashboard
4. ✅ Verify error details are complete

This validates the core error logging flow is functional.
