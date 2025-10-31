Write-Host "Building Poker Tracker..." -ForegroundColor Cyan
npx tsc

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Summary of changes:" -ForegroundColor Yellow
    Write-Host "1. Removed total profit from navbar header" -ForegroundColor White
    Write-Host "2. Added totals bar below header showing Total, Live, and Online P&L" -ForegroundColor White
    Write-Host "3. Changed year selector to quarterly/annual period selector" -ForegroundColor White
    Write-Host "4. Updated chart to show quarterly or annual data instead of daily" -ForegroundColor White
    Write-Host "5. Added new API endpoints for totals and progress data" -ForegroundColor White
    Write-Host "6. Updated database functions to support quarterly/annual grouping" -ForegroundColor White
    Write-Host ""
    Write-Host "Features:" -ForegroundColor Yellow
    Write-Host "- Totals bar shows cumulative P&L for all sources" -ForegroundColor White
    Write-Host "- Chart can display quarterly or annual views" -ForegroundColor White
    Write-Host "- Filter buttons still work to show All/Live/Online data" -ForegroundColor White
    Write-Host "- Progress chart adapts labels based on period selected" -ForegroundColor White
} else {
    Write-Host "Build failed!" -ForegroundColor Red
}
