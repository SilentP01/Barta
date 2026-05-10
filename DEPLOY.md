# Deploy Barta on Railway

## 1. Push the code to GitHub

Open PowerShell inside this project folder and run:

```powershell
git init
git add .
git commit -m "Deploy Barta"
git branch -M main
git remote add origin https://github.com/SilentP01/Barta.git
git push -u origin main
```

If the remote already exists, run this instead:

```powershell
git remote set-url origin https://github.com/SilentP01/Barta.git
git push -u origin main
```

## 2. Create the Railway project

1. Open Railway.
2. Click **New Project**.
3. Choose **Deploy from GitHub repo**.
4. Select `SilentP01/Barta`.
5. Wait for the first build to start.

## 3. Add PostgreSQL

1. Open the Railway project canvas.
2. Click **New**.
3. Choose **Database**.
4. Choose **PostgreSQL**.
5. Wait until the PostgreSQL service is ready.

## 4. Add Barta variables

Open the Barta web service, then go to **Variables** and add:

```text
HOST=0.0.0.0
NODE_ENV=production
NIXPACKS_NODE_VERSION=24
DATABASE_URL=${{Postgres.DATABASE_URL}}
EMAIL_PROVIDER=brevo
EMAIL_API_KEY=your_brevo_api_key
EMAIL_FROM=no-reply@yourdomain.com
EMAIL_FROM_NAME=no-reply.Barta
MAX_ONLINE_USERS=250
PG_POOL_MAX=12
```

Use SendGrid instead of Brevo if you prefer:

```text
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=your_sendgrid_api_key
EMAIL_FROM=no-reply@yourdomain.com
EMAIL_FROM_NAME=no-reply.Barta
```

## 5. Create the email sender

For Brevo:

1. Create or open your Brevo account.
2. Go to **Settings**.
3. Open **SMTP & API**.
4. Open **API Keys**.
5. Generate a new API key and copy it.
6. Add a sender or domain sender.
7. Verify the sender email or authenticate the domain.
8. Use that sender email as `EMAIL_FROM`.

For SendGrid:

1. Create or open your SendGrid account.
2. Go to **Settings**.
3. Open **API Keys**.
4. Create a restricted key with Mail Send permission.
5. Go to **Sender Authentication**.
6. Verify a sender identity or authenticate your domain.
7. Use that verified sender email as `EMAIL_FROM`.

## 6. Redeploy

1. Go back to the Barta service in Railway.
2. Open **Deployments**.
3. Click **Redeploy**.
4. Wait until the deployment says successful.

## 7. Test

Open:

```text
https://your-railway-domain.up.railway.app/api/health
```

Expected response:

```json
{"ok":true,"app":"Barta"}
```

Then test signup with a real email address. The account is created only after the magic link is clicked.

## 8. Admin user commands

Run these only from a machine where `DATABASE_URL` is set:

```text
node admin-users.js list
node admin-users.js get user@example.com
node admin-users.js set-email old@example.com new@example.com
node admin-users.js set-username user@example.com new_username
node admin-users.js set-password user@example.com NewStrongPassword123
node admin-users.js delete user@example.com
```
