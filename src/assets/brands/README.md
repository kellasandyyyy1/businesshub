# Payment brand logos

Brand marks shown beside matching payment methods — in Settings → Payment
methods, in the quick-add chips, and in a transaction's details. Methods are
matched by name, so "PayMaya" and "Maya Business" both get Maya's mark.

**Images** live in `public/svg-icon` and are listed by hand in
`src/lib/paymentMethods.js` (`IMAGE_LOGOS`), each with how it fits the tile:

| Slug        | File                             |
| ----------- | -------------------------------- |
| `gcash`     | `public/svg-icon/gcash.png`      |
| `maya`      | `public/svg-icon/paymaya.jpg`    |
| `grabpay`   | `public/svg-icon/grabpay.jpg`    |
| `gotyme`    | `public/svg-icon/gotyme.png`     |
| `shopeepay` | `public/svg-icon/shopeepay.webp` |
| `cash`      | `public/svg-icon/cash.png`       |
| `bank`      | `public/svg-icon/banktransfer.png` (Bank, Bank Transfer, InstaPay…) |
| `card`      | `public/svg-icon/debitcard.png` (Debit, Credit, Card…) |

**Vectors** live here as `<slug>.svg` and are picked up automatically (restart
the dev server after adding one). A vector wins over an image of the same slug.

- `paypal.svg`, `visa.svg` — from Simple Icons (CC0), filled in brand colour
- `mastercard.svg` — the two-circle mark in its brand colours
