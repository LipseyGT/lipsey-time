# Lipsey Time — QR Codes Module

Creates:

- `app/dashboard/qr-codes/page.tsx`
- `app/dashboard/qr-codes/actions.ts`
- `app/dashboard/qr-codes/_lib/access.ts`
- `app/dashboard/qr-codes/_components/print-button.tsx`
- `app/dashboard/qr-codes/[token]/print/page.tsx`

Required dependencies:

```powershell
npm.cmd install --save-exact qrcode@1.5.4
npm.cmd install --save-dev --save-exact @types/qrcode@1.5.6
```

The production scan URL is encoded as:

`https://time.lipseygintech.com/q/[token]`

The printable sign is US Letter portrait and uses a high-error-correction
black-on-white QR code.
