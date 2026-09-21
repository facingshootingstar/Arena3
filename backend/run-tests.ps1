<#
    Chạy bộ test TestNG cho buổi demo.

        .\run-tests.ps1 1      # Người thuyết trình 1 - tính giá & chiết khấu
        .\run-tests.ps1 2      # Người thuyết trình 2 - giữ chỗ & trùng lịch
        .\run-tests.ps1        # cả hai module, dùng để kiểm tra trước buổi nói

    Console Windows mặc định ở code page 437, không có chữ tiếng Việt. Khi
    stdout là console thật, JDK 17 mã hoá System.out theo code page của
    console chứ không theo file.encoding, nên mọi dấu tiếng Việt trong phần
    tường thuật bị thay bằng "?". Phải đổi cả hai phía mới đọc được: console
    sang UTF-8 (chcp) và JVM sang UTF-8 (sun.stdout.encoding). Chạy qua pipe
    thì không lộ lỗi này, nên nó chỉ xuất hiện khi gõ tay trong terminal.
#>
param(
    [ValidateSet('1', '2', 'all')]
    [string]$Module = 'all'
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

chcp 65001 | Out-Null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe"))) {
    $candidate = Get-ChildItem -Directory -ErrorAction SilentlyContinue -Path @(
        "$env:USERPROFILE\.jdks"
        'C:\Program Files\Java'
        'C:\Program Files\Eclipse Adoptium'
    ) | Where-Object { $_.Name -match '17' } | Select-Object -First 1

    if (-not $candidate) {
        Write-Host 'Khong tim thay JDK 17. Dat JAVA_HOME tro toi mot ban JDK 17 roi chay lai.' -ForegroundColor Red
        exit 1
    }
    $env:JAVA_HOME = $candidate.FullName
}

$env:MAVEN_OPTS = '-Dfile.encoding=UTF-8 -Dsun.stdout.encoding=UTF-8 -Dsun.stderr.encoding=UTF-8'

# -o chạy offline: nhanh hơn và không phụ thuộc mạng lúc đang demo. Bỏ -o nếu
# chạy lần đầu trên một máy chưa tải sẵn dependency.
$profileArgs = switch ($Module) {
    '1'   { @('-Pmodule1-pricing') }
    '2'   { @('-Pmodule2-booking') }
    'all' { @() }
}

$mvnArgs = @('-o') + $profileArgs + @('test')
& .\mvnw.cmd $mvnArgs
exit $LASTEXITCODE
