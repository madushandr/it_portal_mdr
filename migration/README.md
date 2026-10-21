# Import CSV files from the old spreadsheet

1. Export a Google Sheets tab as CSV.
2. Save it in this folder using the portal module key as the filename, for example **hardware_inventory.csv**.
3. The first row must contain column headings. The importer turns headings such as **Asset ID** into **asset_id**, and maps common old headings such as **Location / Hub** to **location**.
4. Create the Supabase Auth administrator account and portal profile first. Copy that Auth user's UUID.
5. Open PowerShell in the project folder and set these environment variables:

~~~powershell
$env:SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co"
$env:SUPABASE_SECRET_KEY = "YOUR-SUPABASE-SECRET-KEY"
$env:PORTAL_ADMIN_USER_ID = "YOUR-ADMIN-AUTH-USER-UUID"
node .\migration\import-csv.mjs
~~~

Use the Supabase secret key only on your own computer for the import. Do not put it in the website, GitHub, or this folder. Remove it from the PowerShell session after import:

~~~powershell
Remove-Item Env:SUPABASE_SECRET_KEY
~~~

The importer adds new rows; it does not update existing ones or deduplicate records. Start with one small CSV and inspect the portal before importing the rest. Do not import the old Users/Passwords sheet. Create fresh Auth users and portal profiles instead.

Supported filenames:

**hardware_inventory.csv**, **non_asset_inventory.csv**, **hardware_dispatch.csv**, **support_tickets.csv**, **remote_desktop.csv**, **licenses.csv**, **network_voice.csv**, **toner_inventory.csv**, **toner_transactions.csv**, **spare_parts.csv**, **supplier_payments.csv**, **monthly_payments.csv**, **it_documents.csv**, **handover_records.csv**, **notification_settings.csv**, **handover_settings.csv**.
