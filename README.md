# LeafletPro Elite

A premium leaflet distribution website package with:
- £10k-level conversion-focused homepage
- Leaflet + OpenStreetMap London coverage map
- postcode-aware pricing calculator
- Stripe checkout booking flow
- protected admin dashboard
- JSON storage starter

## Setup

1. Install dependencies
   npm install

2. Create `.env` from `.env.example`

3. Start the app
   npm start

4. Open
   http://localhost:3000
   Admin dashboard: http://localhost:3000/admin/

## Notes

- Admin routes use HTTP Basic Auth from `.env`
- Stripe checkout works after adding your live/test keys
- The success page verifies the Stripe session and marks the order paid
- Orders are stored in `data/orders.json`
- The London coverage map uses Leaflet + OpenStreetMap and includes service zones

## Recommended next upgrade

Move order storage from JSON to Postgres or Supabase and add Stripe webhooks for production-grade reconciliation.
