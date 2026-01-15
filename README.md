# Admin Panel

Dashboard app for managing Botschafter (ambassadors), schools, and events. Built with Next.js and PocketBase. The UI is in German.

## Features
- Botschafter: active/pending lists, verify action, advanced filters, bulk edit/delete, import/export.
- Schulen: list with the same management features as Botschafter.
- Events: list view and month calendar view, click rows/cards to open a full editor dialog.
- Forms/Resources: placeholder pages ready for future CRUD.
- Auth: PocketBase users collection with login/signup.

## Tech Stack
- Next.js 16 (App Router)
- React 19
- PocketBase
- Tailwind CSS + Radix UI

## Local Setup
1. Install dependencies:
   `npm install`
2. Start PocketBase (uses the bundled data directory):
   `./pocketbase/pocketbase serve --dir pocketbase/pb_data`
3. Create `.env.local`:
   `NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090`
4. Start the app:
   `npm run dev`
   Open `http://localhost:3000`.

## PocketBase Collections
- `users`: default PocketBase auth collection.
- `members`: `name`, `email`, `phone`, `city`, `active` (bool), `identification` (number).
- `schools`: `name`, `email`, `phone`, `city`, `active` (bool), `identification` (number).
- `events`: `name`, `description`, `date` (date), `category`, `ambassadors` (relation -> `members`, multiple).

## Notes
- Events can be managed in list or month calendar view.
- The client-side auth guard uses `pb.authStore` to protect routes.
