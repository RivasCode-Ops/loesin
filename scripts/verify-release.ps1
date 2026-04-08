$ErrorActionPreference = "Stop"

Write-Host "== LOESIN Release Verification ==" -ForegroundColor Cyan

Write-Host "`n1) JavaScript syntax check..." -ForegroundColor Yellow
node --check script.js

Write-Host "`n2) Critical automated tests..." -ForegroundColor Yellow
node --test tests/*.test.mjs

Write-Host "`n3) Git status..." -ForegroundColor Yellow
git status --short

Write-Host "`n4) Confirm release tag..." -ForegroundColor Yellow
git tag --list "v2.0.0"

Write-Host "`nVerification complete." -ForegroundColor Green
