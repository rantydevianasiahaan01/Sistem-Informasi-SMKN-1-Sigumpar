# Versi Windows (PowerShell) dari jalankan_semua.sh, untuk PostgreSQL yang
# di-install langsung di Windows (tanpa Docker).
#
# Pemakaian (dari folder repo):
#   powershell -ExecutionPolicy Bypass -File database\v2\jalankan_semua.ps1 -Demo
#
# Parameter:
#   -Ulang     hapus database tujuan dulu lalu bangun dari nol
#   -Demo      ikut menjalankan seed_002_data_demo.sql (akun semua role)
#   -Database  nama database tujuan (default: pkm_v2)
#   -Port      port PostgreSQL (default: 5432)
#   -Psql      lokasi psql.exe (default: dicari otomatis di C:\Program Files\PostgreSQL)
# Password user postgres akan ditanyakan oleh psql.
# JANGAN arahkan ke database tim yang sekarang (pkm_smkn1sigumpar).
param(
    [switch]$Demo,
    [switch]$Ulang,
    [string]$Database = "pkm_v2",
    [int]$Port = 5432,
    [string]$User = "postgres",
    [string]$Psql = ""
)
$ErrorActionPreference = "Stop"

if (-not $Psql) {
    $ketemu = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if (-not $ketemu) { throw "psql.exe tidak ditemukan. Install PostgreSQL atau isi -Psql 'C:\...\psql.exe'" }
    $Psql = $ketemu.FullName
}
Write-Host "Memakai $Psql"

if (-not $env:PGPASSWORD) {
    $aman = Read-Host "Password user $User" -AsSecureString
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($aman))
}
$env:PGOPTIONS = "-c client_min_messages=warning"
$env:PGCLIENTENCODING = "UTF8"

# Buat database kosong kalau belum ada
if ($Database -eq "pkm_smkn1sigumpar") { throw "Jangan pakai database tim. Gunakan nama lain, misalnya pkm_v2." }
if ($Ulang) {
    & $Psql -h localhost -p $Port -U $User -d postgres -q -c "DROP DATABASE IF EXISTS $Database"
}
$ada = & $Psql -h localhost -p $Port -U $User -d postgres -At -c "SELECT 1 FROM pg_database WHERE datname = '$Database'"
if ($LASTEXITCODE -ne 0) { throw "Tidak bisa terhubung ke PostgreSQL. Cek password dan port." }
if ($ada -ne "1") {
    & $Psql -h localhost -p $Port -U $User -d postgres -q -c "CREATE DATABASE $Database"
    Write-Host "Database $Database dibuat"
}

function Jalankan([string]$file) {
    Write-Host ">> $file"
    & $Psql -h localhost -p $Port -U $User -d $Database -v ON_ERROR_STOP=1 -q -f (Join-Path $PSScriptRoot $file)
    if ($LASTEXITCODE -ne 0) { throw "Gagal di $file" }
}

$services = "auth-service", "academic-service", "learning-service", "student-service", "vocational-service", "asset-service"

Jalankan "000-umum\migration_000_ekstensi_enum.sql"
foreach ($n in "001_skema", "002_relasi", "003_aturan") {
    foreach ($s in $services) { Jalankan "$s\migration_${n}_v2.sql" }
}
Jalankan "seed\seed_001_data_awal.sql"
if ($Demo) { Jalankan "seed\seed_002_data_demo.sql" }
Write-Host "Selesai."
