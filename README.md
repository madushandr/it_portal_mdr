# HPL Portal for Cloudflare Pages + Supabase + Personal Google Drive

This folder contains the complete code for the new portal version included here:

- Supabase username/password sign-in for portal-created staff accounts, email/password sign-in for existing accounts, and per-module permissions
- record create, view, edit, delete, search and CSV export across the listed IT portal modules
- private personal Google Drive file upload, download and removal through Google OAuth
- a generated PDF form for a saved portal record, uploaded to Google Drive
- Supabase audit log and an administrator panel for creating staff logins and setting module permissions

## Important scope note

This is a new Cloudflare/Supabase portal foundation based on the modules in your uploaded HPL portal. It is **not a line-for-line conversion of every old Google Apps Script feature**. The uploaded backend contains many custom workflows. This version does not yet reproduce its scheduled email alerts, Gmail ticket routing/replies, detailed toner stock calculations, printer page history, remote desktop launch/access links, original handover/dispatch PDF layouts, or every dashboard calculation. Keep the old portal available until the missing workflows have been migrated and checked.

The existing Apps Script passwords are not imported. The first administrator is still created in Supabase Auth manually. After that, administrators can register staff from the **System Users** panel using a username, password, full name, and module access selections. Existing Auth accounts can continue to sign in using their email.

## Project files

~~~text
README.md
site/
  index.html
  app.js
  config.js
supabase/
  schema.sql
  config.toml
  functions/
    drive-files/
      index.ts
    manage-users/
      index.ts
migration/
  connect-personal-drive.mjs
  (put exported CSV files here)
~~~

## 1. Create the Supabase tables

1. Open your Supabase project.
2. Open **SQL Editor** and choose **New query**.
3. Open **supabase/schema.sql**, copy all of it, paste it into the editor and press **Run**.
4. This creates the profile, portal record, file metadata, and activity log tables, plus row-level security rules.

The portal data rows are stored as JSON in **portal_records.data**. That lets the modules keep fields that were not present in the first setup. Supabase RLS checks the user's module permission for each database request.

## 2. Create the first portal administrator

1. In Supabase, open **Authentication → Users → Add user**.
2. Create an account with an email and password that the administrator can use.
3. Copy the user's **ID**.
4. Open **SQL Editor** and run this after replacing the sample ID:

~~~sql
insert into public.portal_profiles
  (id, username, full_name, is_admin, permissions)
values
  ('PASTE-AUTH-USER-UUID-HERE', 'admin', 'Portal Administrator', true, '{}'::jsonb);
~~~

An administrator (**is_admin = true**) can access every module. For ordinary staff, set **is_admin** to false and grant only the permissions they need. Example:

~~~sql
insert into public.portal_profiles
  (id, username, full_name, is_admin, permissions)
values
  ('PASTE-STAFF-AUTH-UUID-HERE', 'staff1', 'Staff Member', false,
   '{
     "hardware_inventory": {"view": true, "edit": false},
     "support_tickets": {"view": true, "edit": true},
     "it_documents": {"view": true, "edit": false}
   }'::jsonb);
~~~

After the administrator can sign in, create later staff accounts directly from **System Users → Register System User**. Choose **No Access**, **View Only**, or **Full Edit** for each module. The portal stores the login in Supabase Auth and the module permissions in the matching profile. Usernames must be lowercase and unique.

## 3. Connect a personal Google Drive

This version uses the portal owner's personal Google Drive through OAuth. It does not use a service account or a Shared Drive. The owner authorizes access once; portal staff use their normal Supabase accounts, while uploads are stored in the owner's Drive folder. The Drive folder is created by the setup helper so the Drive file scope can access only files created by this app.

### Configure Google OAuth

1. In Google Cloud Console, create or choose a project and enable the **Google Drive API**.
2. Open **Google Auth Platform** and configure the app. Set the audience to **External**, and add the personal Gmail address that owns the Drive as a test user while setting up.
3. Under **Data access**, add this scope: **https://www.googleapis.com/auth/drive.file**.
4. Open **Clients → Create client**, choose **Desktop app**, and create it.
5. Download the OAuth client JSON file. Keep it private and do not upload it to GitHub.
6. During setup, an app in **Testing** is suitable for trying the flow, but Google may expire its refresh tokens after seven days. Before the final connection, set the publishing status to **In production** and run the helper again to create the production refresh token. Google may show an unverified-app warning or request basic OAuth verification. Follow the Google Auth Platform prompts. Do not request the broad **drive** scope for this package.

Google's Desktop OAuth client supports the local callback used by the setup helper. Google OAuth grants a refresh token for server-side offline access; the helper stores it only in your Supabase Function secrets. See [Google OAuth for web/server apps](https://developers.google.com/identity/protocols/oauth2/web-server), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), and [OAuth testing status](https://support.google.com/cloud/answer/15549945?hl=en).

### Get the owner token and create the portal folder

Install Node.js if it is not already installed. Open PowerShell in the extracted project folder and run the helper with the path to the downloaded OAuth client JSON file:

~~~powershell
node migration/connect-personal-drive.mjs "C:\Users\YOUR-NAME\Downloads\client_secret_....json"
~~~

A browser window opens. Sign in to the personal Google account that should own portal uploads and approve the Drive file access. The helper creates **HPL IT Portal Files** in that account's My Drive and prints four values. Add those values in Supabase **Edge Functions → Secrets**:

- **GOOGLE_OAUTH_CLIENT_ID**
- **GOOGLE_OAUTH_CLIENT_SECRET**
- **GOOGLE_OAUTH_REFRESH_TOKEN**
- **GOOGLE_DRIVE_FOLDER_ID**

Treat all four values as private. Never put them in **site/config.js**, GitHub, or a message. If the OAuth app is still in **Testing**, Google may expire refresh tokens after seven days; publish the app to **In production** for ongoing use. A revoked token must be generated again with the helper.

The function keeps each Drive file private and checks the signed-in portal user's module permissions before upload, download, or removal. The Google OAuth owner account's My Drive quota is used.

## 4. Deploy the Supabase Functions

From the project folder, use PowerShell:

~~~powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy drive-files
npx supabase functions deploy manage-users
~~~

Replace **YOUR_PROJECT_REF** with the part before **.supabase.co** in the Supabase Project URL. The Google Function secrets above must already be saved in Supabase. The user-management function uses Supabase's server-side secret automatically; never copy that secret into the website or GitHub. Uploading the repository to GitHub does not deploy these Functions.

The staff account panel only lets portal administrators create users. The Edge Function checks the signed-in administrator before it creates an Auth account. For staff created in this panel, the login email is an internal `@portal.hpl.invalid` address; staff sign in by entering the username and password. Existing accounts can still sign in with their email. Because the internal address cannot receive mail, a forgotten staff password must be reset by an administrator in **Supabase → Authentication → Users**.

## 6. Check the website settings

Open **site/config.js**. It currently contains the Supabase URL and publishable key used by the earlier starter. Replace them if they do not match your project.

- **supabaseUrl**: Supabase **Project URL**
- **publishableKey**: Supabase **publishable key** (older projects may label this **anon** or **public**)

Only the publishable key belongs in this browser file. Never use a Supabase secret/service-role key, OAuth client secret, refresh token, or Google credential JSON here.

## 7. Upload to GitHub and publish with Cloudflare Pages

1. Upload the contents of **hpl-portal-full** to your GitHub repository. Keep the **site** and **supabase** folders in place. Make the repository private if it contains internal portal code.
2. In Cloudflare Pages, connect the repository.
3. Use the repository root as the **Root directory** (leave it blank/default), **exit 0** as the build command, and **site** as the build output directory.
4. Deploy. Cloudflare Pages will publish **site/index.html**.
5. In Supabase **Authentication → URL Configuration**, add your Cloudflare Pages address to the allowed site/redirect URLs.
6. Sign in using the administrator Auth email and password, then register staff from the portal's **System Users** panel.

The Edge Function is deployed to Supabase with the CLI; uploading the repository to GitHub does not deploy that function automatically.

## 8. Use files and PDF forms

1. Open a module and create a record.
2. Open that saved record.
3. Choose one or more images/documents, then press **Save record**.
4. The browser sends the file to the Supabase Function. The function checks the signed-in user's module permission, uploads the file into the owner's private My Drive folder through OAuth, and saves the Drive file ID and metadata in Supabase.
5. Use **Download** or **Remove** beside an attached file.
6. **Generate PDF form** creates a simple PDF summary of the current record fields and uploads it as another private Drive file.

The page stores metadata in Supabase, not the document contents. The Google Drive file remains private. Do not change the Drive permissions to **Anyone with the link** for confidential files.

## 9. Move existing spreadsheet records

The old Google Sheets rows are not copied automatically. The included importer can add CSV exports to **public.portal_records**:

1. Export one sheet tab as CSV and save it under **migration/csv/** using its module key, such as **hardware_inventory.csv**.
2. Follow **migration/README.md** to set the Supabase URL, temporary secret key, and administrator Auth UUID in a local PowerShell session.
3. Run the importer on one small CSV first and inspect its records in the website.

The importer adds rows; it does not deduplicate or update existing rows. Do not import the old Users/Passwords sheet. Keep a backup of all original spreadsheets.

Existing Drive links from the old portal may be public links. They will not automatically become private Drive attachments in the new portal; re-upload the files through the new portal or migrate them with a separate Drive migration script.

## Module keys

Use these exact values when setting staff permissions:

**hardware_inventory**, **non_asset_inventory**, **hardware_dispatch**, **support_tickets**, **remote_desktop**, **licenses**, **network_voice**, **toner_inventory**, **toner_transactions**, **spare_parts**, **supplier_payments**, **monthly_payments**, **it_documents**, **handover_records**, **notification_settings**, **handover_settings**, **user_management**, **activity_log**.

Permission format:

~~~json
{
  "hardware_inventory": { "view": true, "edit": false },
  "it_documents": { "view": true, "edit": true }
}
~~~

## Before switching staff to the new portal

The code in this package is a data-entry foundation for the modules listed above. Recreate and check each old workflow that your staff rely on, especially email notifications, ticket assignment, toner stock arithmetic, and the original PDF layouts. Do not delete or shut down the Apps Script portal or its spreadsheets until the data and required workflows have been moved.

## Official setup references

- [Supabase database security and RLS](https://supabase.com/docs/guides/database/secure-data)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase Edge Function deployment](https://supabase.com/docs/guides/functions/quickstart)
- [Cloudflare Pages with Git](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Google Drive API uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
