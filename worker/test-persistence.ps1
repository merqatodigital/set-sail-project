# Persistence Test Script
# Tests Computer workspace persistence across separate HTTP requests

$baseUrl = "http://127.0.0.1:8790"
$token = "persist-" + [System.Guid]::NewGuid().ToString("N").Substring(0,8)

Write-Host "============================================"
Write-Host "  PERSISTENCE TEST"
Write-Host "  Token: $token"
Write-Host "============================================"

# REQUEST A: Write a unique file
Write-Host "`n--- REQUEST A: WRITE ---"
$writeBody = @{ action = "write"; token = $token } | ConvertTo-Json
$writeResp = Invoke-RestMethod -Uri "$baseUrl/api/computer/persistence-diag" -Method Post -ContentType "application/json" -Headers @{ "X-Dev-Tenant" = "marina_terrace" } -Body $writeBody
Write-Host ($writeResp | ConvertTo-Json -Depth 5)

# REQUEST B: Read the same file (separate HTTP request)
Write-Host "`n--- REQUEST B: READ ---"
$readBody = @{ action = "read"; path = "diag/persistence.md" } | ConvertTo-Json
$readResp = Invoke-RestMethod -Uri "$baseUrl/api/computer/persistence-diag" -Method Post -ContentType "application/json" -Headers @{ "X-Dev-Tenant" = "marina_terrace" } -Body $readBody
Write-Host ($readResp | ConvertTo-Json -Depth 5)

# Verify the token matches
if ($readResp.content -match $token) {
    Write-Host "`n>>> PERSISTENCE CHECK: PASS (token found in read response)"
} else {
    Write-Host "`n>>> PERSISTENCE CHECK: FAIL (token NOT found in read response)"
}

# REQUEST C: List directory (separate HTTP request)
Write-Host "`n--- REQUEST C: LIST ---"
$listBody = @{ action = "list" } | ConvertTo-Json
$listResp = Invoke-RestMethod -Uri "$baseUrl/api/computer/persistence-diag" -Method Post -ContentType "application/json" -Headers @{ "X-Dev-Tenant" = "marina_terrace" } -Body $listBody
Write-Host ($listResp | ConvertTo-Json -Depth 5)

# REQUEST D: Stat the file (separate HTTP request)
Write-Host "`n--- REQUEST D: STAT ---"
$statBody = @{ action = "stat"; path = "diag/persistence.md" } | ConvertTo-Json
$statResp = Invoke-RestMethod -Uri "$baseUrl/api/computer/persistence-diag" -Method Post -ContentType "application/json" -Headers @{ "X-Dev-Tenant" = "marina_terrace" } -Body $statBody
Write-Host ($statResp | ConvertTo-Json -Depth 5)

# REQUEST E: Search for the token (separate HTTP request)
Write-Host "`n--- REQUEST E: SEARCH ---"
$searchBody = @{ action = "search"; token = $token } | ConvertTo-Json
$searchResp = Invoke-RestMethod -Uri "$baseUrl/api/computer/persistence-diag" -Method Post -ContentType "application/json" -Headers @{ "X-Dev-Tenant" = "marina_terrace" } -Body $searchBody
Write-Host ($searchResp | ConvertTo-Json -Depth 5)

# Summary
Write-Host "`n============================================"
Write-Host "  SUMMARY"
Write-Host "============================================"
$writeOk = $writeResp.written -eq $true
$readOk = $readResp.exists -eq $true -and $readResp.content -match $token
$statOk = $statResp.exists -eq $true
$searchOk = $null -ne $searchResp.matches -and $searchResp.matches.Count -gt 0

Write-Host "  Write:  $(if ($writeOk) {'PASS'} else {'FAIL'})"
Write-Host "  Read:   $(if ($readOk) {'PASS'} else {'FAIL'})"
Write-Host "  Stat:   $(if ($statOk) {'PASS'} else {'FAIL'})"
Write-Host "  Search: $(if ($searchOk) {'PASS'} else {'FAIL'})"
Write-Host ""
Write-Host "  Tenant: $($writeResp.tenantId)"
Write-Host "  DiagPath: $($writeResp.diagPath)"
Write-Host ""

if ($writeOk -and $readOk -and $statOk -and $searchOk) {
    Write-Host "  RESULT: PERSISTENCE PASSES"
} else {
    Write-Host "  RESULT: PERSISTENCE FAILS"
}
Write-Host "============================================"
