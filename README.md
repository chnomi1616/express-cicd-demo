# Express CI/CD Pipeline — Beginner A-to-Z Guide

This repo contains a small Express app wired to a full CI/CD pipeline:
Test → Docker Build → Trivy Scan → GitLeaks Scan → Push to Docker Hub → Deploy to EC2.

Follow the phases **in order**. Do not skip ahead — each phase depends on the one before it.
Do a phase, confirm it works, then move to the next one. That's how you avoid the "I don't
know what broke" feeling.

---

## Phase 0 — Prerequisites (accounts you need)

- A GitHub account (free)
- A Docker Hub account (free) → https://hub.docker.com
- An AWS account (free tier is enough) → https://aws.amazon.com
- Node.js and Docker installed on your own laptop (to test locally first)

---

## Phase 1 — Run the app locally (make sure it works before anything else)

```bash
cd app
npm install
npm test        # should show 2 passing tests
npm start        # visit http://localhost:3000/health
```

If `npm test` and `/health` both work locally, you're safe to move on.

---

## Phase 2 — Test the Docker image locally

```bash
cd app
docker build -t express-demo .
docker run -p 3000:3000 express-demo
curl http://localhost:3000/health
```

If this works, Docker is not going to be your problem later. Confirming this now saves you
hours of confused debugging inside GitHub Actions logs later.

---

## Phase 3 — Create the GitHub repository

1. Create a new repo on GitHub (e.g. `express-cicd-demo`).
2. Push this project folder to it:
   ```bash
   git init
   git add .
   git commit -m "initial commit: app + dockerfile + workflow"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
3. Create the `develop` branch from `main`:
   ```bash
   git checkout -b develop
   git push -u origin develop
   ```

**Mental model:** `main` = production, `develop` = staging. From now on you always work on
`develop` first, and only merge to `main` when you're confident.

---

## Phase 4 — Create a Docker Hub access token

1. Log into Docker Hub → Account Settings → **Security** → **New Access Token**.
2. Give it a name, copy the token (you only see it once).
3. Also note your Docker Hub **username**.

You do NOT use your Docker Hub password anywhere. Only this token.

---

## Phase 5 — Launch two EC2 instances (staging + production)

You need **two** small servers — one for staging, one for production. (You can start with
just one for staging while you're learning, and add production later.)

1. AWS Console → EC2 → Launch Instance.
2. Choose **Ubuntu 22.04**, instance type `t2.micro` (free tier).
3. Create/download a new **key pair** (`.pem` file) — this is your SSH private key.
4. Security group: allow inbound **SSH (22)** from your IP, and **HTTP (80)** from anywhere.
5. Launch it. Note its **public IPv4 address**.
6. SSH into it and install Docker:
   ```bash
   ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
   sudo apt update
   sudo apt install -y docker.io
   sudo usermod -aG docker ubuntu
   ```
   Log out and back in for the docker group permission to apply.

Repeat for a second instance if you want a separate production server.

---

## Phase 6 — Add GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**.
Add these one by one:

| Secret name           | Value                                              |
|------------------------|-----------------------------------------------------|
| `DOCKERHUB_USERNAME`   | your Docker Hub username                            |
| `DOCKERHUB_TOKEN`      | the access token from Phase 4                       |
| `EC2_USERNAME`         | `ubuntu`                                             |
| `EC2_STAGING_HOST`     | public IP of your staging EC2 instance               |
| `EC2_PROD_HOST`        | public IP of your production EC2 instance            |
| `EC2_SSH_KEY`          | full contents of your `.pem` private key file        |

To get the `.pem` contents: `cat your-key.pem` and copy everything, including the
`-----BEGIN...-----` and `-----END...-----` lines.

---

## Phase 7 — Create GitHub Environments (this is what gives you manual approval)

1. Repo → **Settings → Environments → New environment**.
2. Create one called `staging`. No protection rules needed — leave it open.
3. Create another called `production`.
4. On `production`, check **"Required reviewers"** and add yourself.
5. Save.

Now: any job in the workflow that says `environment: name: production` will **pause and
wait** for you to click Approve in the Actions tab before it runs. That's the entire
"manual approval" feature — no extra code required.

---

## Phase 8 — The workflow file (already included)

Look at `.github/workflows/ci-cd.yml` in this project. It does exactly the 6 stations
described in the intro. You don't need to write this yourself — it's ready. Just skim it
once so you recognize the job names: `test`, `gitleaks`, `build-and-scan`, `push`,
`deploy-staging`, `deploy-production`.

---

## Phase 9 — Test the full pipeline end-to-end

1. Make a small change (e.g. edit the welcome message in `app/index.js`).
2. Commit and push to `develop`:
   ```bash
   git checkout develop
   git add .
   git commit -m "test staging deploy"
   git push origin develop
   ```
3. Go to the **Actions** tab on GitHub — watch the jobs run in order.
4. If `deploy-staging` succeeds, visit `http://<EC2_STAGING_HOST>` in your browser.
5. When you're happy, open a **Pull Request from develop into main**, merge it.
6. Go to **Actions** tab — you'll see `deploy-production` sitting there **waiting for
   approval**. Click into it, click **Review deployments → Approve and deploy**.
7. Visit `http://<EC2_PROD_HOST>` — your production app is live.

---

## Troubleshooting checklist (what usually breaks for beginners)

- **Tests fail in CI but passed locally** → you probably forgot `package-lock.json` — run
  `npm install` locally once and commit the generated `package-lock.json`.
- **Docker push fails with "unauthorized"** → wrong Docker Hub token, or you're using your
  password instead of the token.
- **SSH deploy step fails** → check the EC2 security group allows port 22 from GitHub's
  IPs (or just "Anywhere" while testing), and that `EC2_SSH_KEY` secret has the *entire*
  key file including BEGIN/END lines.
- **Trivy scan fails the whole pipeline** → that's expected behavior if it finds
  HIGH/CRITICAL vulnerabilities — read the table it prints, it tells you which package.
- **Production deploy never runs** → check you actually merged into `main`, not just
  opened the PR. Only a push event triggers deploy jobs.

---

## Why the pipeline is structured this way (so you understand it, not just copy it)

- `test` runs first — no point building a Docker image of broken code.
- `gitleaks` and `build-and-scan` (Trivy) both run before anything is pushed anywhere —
  security gates come before publishing.
- `push` only happens on an actual `push` event (not on pull requests) — you don't want to
  publish a Docker image for every draft PR.
- `deploy-staging` and `deploy-production` are separate jobs so each can point at a
  different server and have different approval rules.
