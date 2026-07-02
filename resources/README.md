# Kernel Binary Directory

This directory should contain the compiled Go kernel binary:
- Windows: `kernel.exe`
- Linux: `kernel`
- macOS: `kernel`

## Build Instructions

### Windows
```powershell
cd kernel
$env:GOOS="windows"; $env:GOARCH="amd64"; go build -o ../resources/kernel.exe .
```

### Linux
```bash
cd kernel
GOOS=linux GOARCH=amd64 go build -o ../resources/kernel .
```

### macOS
```bash
cd kernel
GOOS=darwin GOARCH=amd64 go build -o ../resources/kernel .
```

## Development

When running `npm run dev`, the Electron process will look for the kernel binary here.
If the binary is not found, the app will start in "mock mode" where all API calls
return simulated responses for frontend development.
