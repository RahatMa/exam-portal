# OMR Practice Portal: setup guide

This guide assumes no programming experience. Follow the parts in order. The whole setup takes about an hour the first time.

## What is in this folder

| File | What it is | Where it goes |
|---|---|---|
| `index.html` | The student portal (the website). | GitHub |
| `generator.html` | A tool for you that turns book IDs into printable QR codes. | GitHub |
| `Code.gs` | The "brain": checks answers, locks main attempts, keeps scores. | Google Sheets (Apps Script) |
| `README.md` | This guide. | GitHub (optional) |

**How the pieces fit:** students open your website (hosted free on GitHub Pages). The website sends their answers to a small program inside your Google Sheet. That program checks them against the answer key, which stays private in your sheet, and sends back the result and solutions.

---

## Part 1: Set up the Google Sheet (the backend)

Use a Google account that belongs to your business, because this account will own all student data.

1. Go to [sheets.google.com](https://sheets.google.com) and create a **blank spreadsheet**. Name it something like `OMR Portal`.
2. In the menu, click **Extensions > Apps Script**. A code editor opens in a new tab.
3. Delete everything in the editor. Open `Code.gs` from this folder in Notepad (or any text editor), copy **all** of it, and paste it in.
4. Click the **Save** icon (💾). Rename the project at the top-left to `OMR Portal`.
5. Go back to the spreadsheet tab and **reload the page**. After a few seconds a new menu called **OMR Portal** appears next to Help.
6. Click **OMR Portal > 1. Set up sheets (first time)**.
7. Google asks for permission:
   - Click **Continue** and choose your account.
   - You'll see "Google hasn't verified this app". This is normal for your own script. Click **Advanced > Go to OMR Portal (unsafe)**, then **Allow**.
   - Run **OMR Portal > 1. Set up sheets** again if nothing happened the first time.
8. You now have these tabs: **Books, Exams, Questions, Attempts, Settings**. The sample physics exam (PHY-01, 20 questions) and three test books (`DEMO-0001`, `DEMO-0002`, `DEMO-0003`) are already filled in.

### Publish the backend as a web app

9. In the Apps Script tab, click **Deploy > New deployment**.
10. Click the gear icon next to "Select type" and choose **Web app**.
11. Fill in:
    - Description: `v1`
    - Execute as: **Me**
    - Who has access: **Anyone**
12. Click **Deploy**, then copy the **Web app URL**. It ends with `/exec`. Keep it handy.
13. Check it works: paste that URL into a new browser tab. You should see `{"ok":true,"message":"OMR portal API is running."}`.

> **Important for later:** if you ever change `Code.gs`, go to **Deploy > Manage deployments**, click the pencil ✏️, set **Version** to **New version**, and click **Deploy**. This keeps the same URL. Creating a "New deployment" instead would give you a new URL, and the website would stop working until you update it.

---

## Part 2: Put the website on GitHub Pages

### Edit three settings in `index.html`

1. Open `index.html` in Notepad. Near the top you'll find:

   ```js
   const CONFIG = {
     API_URL: 'PASTE_YOUR_WEB_APP_URL_HERE',
     SITE_NAME: 'পদার্থবিজ্ঞান অনুশীলন বই',
     SUPPORT_CONTACT: 'প্রকাশকের হেল্পলাইন: 01XXXXXXXXX',
   };
   ```

2. Replace `PASTE_YOUR_WEB_APP_URL_HERE` with the `/exec` URL from Part 1. Keep the quote marks.
3. Change `SITE_NAME` to your book or brand name, and `SUPPORT_CONTACT` to your helpline. Save the file.

### Upload to GitHub

4. Create a free account at [github.com](https://github.com) if you don't have one.
5. Click **+ > New repository**. Name it, for example, `exam-portal`. Choose **Public** (free GitHub Pages needs a public repository; this is safe because no answers or student data are in these files). Click **Create repository**.
6. Click **uploading an existing file**, drag in `index.html`, `generator.html` and `README.md`, then click **Commit changes**.
7. Go to the repository's **Settings > Pages**. Under "Build and deployment", set Source to **Deploy from a branch**, Branch to **main** and folder **/ (root)**, then **Save**.
8. Wait one or two minutes and refresh. GitHub shows your site address, like `https://yourname.github.io/exam-portal/`.

### Connect your own domain

9. Decide on an address, for example `exam.yourdomain.com`.
10. In **Settings > Pages > Custom domain**, type `exam.yourdomain.com` and click **Save**.
11. Log in to the company where you bought your domain and open its **DNS settings**. Add one record:
    - Type: **CNAME**
    - Name/Host: `exam`
    - Value/Target: `yourname.github.io`

    If you want to use the bare domain (`yourdomain.com` without `exam.`), add four **A** records instead, pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`.
12. DNS can take from a few minutes to a few hours. When GitHub shows the domain as working, tick **Enforce HTTPS**.

### Tell the sheet your address

13. In the Google Sheet, open the **Settings** tab and set `SITE_URL` to your address with a slash at the end, for example `https://exam.yourdomain.com/`.

---

## Part 3: Test everything with a demo book

1. On your phone, open `https://exam.yourdomain.com/?book=DEMO-0001`.
2. Register with a test name, phone number and a PIN.
3. Tap **উত্তর জমা দিন**, fill some bubbles, and submit. This is the main attempt. Check that a row appears in the **Attempts** tab.
4. Go back and tap **আবার অনুশীলন করুন**. Submit again. You get results and solutions, but **no new row** appears in Attempts. That's the practice mode.
5. Open the same link in a different browser. It should ask for the PIN.

When you're happy, **delete the three DEMO rows** from the Books tab (and their rows from Attempts) before selling books.

---

## Part 4: Add your own exams and questions

### Exams tab

One row per exam in the book.

| Column | What to type |
|---|---|
| ExamID | A short code with no spaces, for example `PHY-02`. Never change it after students start. |
| ExamName | The title students see. |
| Subject | Optional. |
| Order | 1, 2, 3… controls the order on the student's list. |
| Open | Tick the checkbox (or type `TRUE`) to show the exam to students. Untick to hide it. |

### Questions tab

One row per question.

| Column | What to type |
|---|---|
| ExamID | Must match the Exams tab exactly. |
| QNo | 1, 2, 3… with no gaps. Must match the numbering on the printed OMR sheet. |
| Question | The question text. |
| ImageURL | Optional link to a diagram (see below). |
| OptionA–OptionD | The four options (ক, খ, গ, ঘ). |
| Answer | The correct option: `ক`, `খ`, `গ`, `ঘ` (or `A`–`D`). |
| Solution | The detailed solution. |

**Writing math.** Put math between `\(` and `\)` for inline formulas, and between `\[` and `\]` for a formula on its own line. For example:

```
বল \(F = ma\) থেকে পাই:
\[a = \frac{F}{m} = \frac{10}{5} = 2\ \mathrm{m\,s^{-2}}\]
```

Look at the sample questions in the sheet for many more examples.

**Line breaks inside a cell.** Press **Ctrl + Enter** (Windows) or **⌘ + Enter** (Mac).

**Two Google Sheets traps:**
- A cell starting with `=` becomes a formula. Wrap math in `\( \)` or start the cell with an apostrophe `'`.
- Google Sheets turns things like `1:2` into a time and `1/2` into a date. Wrap them in `\( \)`, e.g. `\(1:2\)`.

**Images.** Create a folder named `images` in your GitHub repository, upload the picture there, and use its address in ImageURL, for example `https://exam.yourdomain.com/images/phy02-q5.png`.

**Tip:** you can send Claude a question set (Word text, like the sample) and ask for it "as rows for the Questions tab". You'll get rows ready to paste.

---

## Part 5: Print the books

1. Make sure `SITE_URL` in Settings is your real address. The QR codes are built from it and can't be changed after printing.
2. Click **OMR Portal > Generate new book IDs…**. Enter how many books you're printing and a batch name. New random IDs (like `7K3M-9Q2X`) are added to the Books tab.
3. Open `https://exam.yourdomain.com/generator.html`. Enter your site address and paste the new BookID cells.
4. Click **Make QR codes**, then either:
   - **Print or save as PDF** to get a sheet of stickers, or
   - **Download CSV** and give it to your printing press for variable-data printing (each book gets its own QR).
5. Print the ID in text under each QR code too, so students can type it if the camera won't scan.

---

## Part 6: Running the portal

**A student forgot their PIN.** Confirm it's really them (for example, they call from the registered phone). In the Books tab, clear their **PinHash** cell. When they open the portal, it asks for their registered phone number and a new PIN.

**Block a book** (for example, a pirated copy). Set its **Status** to `BLOCKED`.

**You find a wrong answer key.** Fix the Answer cell, then click **OMR Portal > Recalculate all scores**. Every stored main attempt is re-marked.

**Negative marking.** In Settings, set `MARK_WRONG` to, for example, `-0.25`, then run **Recalculate all scores**.

**The top-100 list.**
- Only students who have submitted the main attempt of **every open exam** are ranked.
- Higher total marks rank first. On a tie, whoever finished the whole book earlier ranks higher.
- **OMR Portal > Build leaderboard tab** creates a private ranking for you, with phone numbers, so you can contact students for the competition. Students can't see it.
- To show the top list to students, tick **LEADERBOARD_PUBLISHED** in Settings. `LEADERBOARD_SIZE` controls how many are shown (100 by default).
- Publish only after all exams in the book are open. Opening a new exam later changes who counts as "finished".

**Backups.** Every week or so, use **File > Make a copy** on the Google Sheet.

---

## Things to know

- **Honesty of answers.** Students type the bubbles from their paper OMR sheet. The system makes the first submission permanent and keeps the answer key hidden until after submission, but it can't see the paper. This is fine for practice; for the final competition, use a supervised exam.
- **Capacity.** Each check takes 1–3 seconds. Google Apps Script handles roughly 30 requests at the very same moment, which is plenty for a practice book used at different times. If you expect thousands of students submitting in the same minute, consider moving to a paid backend later.
- **Privacy.** The sheet holds students' names and phone numbers. Don't share edit access with anyone you don't trust.

## Troubleshooting

| What you see | What to do |
|---|---|
| "Portal setup is not finished: paste the Apps Script Web app URL…" | `API_URL` in `index.html` is not set. See Part 2. |
| "সার্ভারের সাথে সংযোগ হয়নি" for everyone | Check the deployment has **Who has access: Anyone**, and that the URL ends with `/exec`. |
| You changed `Code.gs` but nothing changed | Deploy a **New version** (see the note at the end of Part 1). |
| "Server setup is not finished…" | Run **OMR Portal > 1. Set up sheets**. Don't rename the tabs or the header row. |
| The website doesn't show your latest edit | GitHub takes about a minute. Then refresh the page (on phone, close and reopen the tab). |
| Math shows as `\(...\)` text | Check each `\(` has a matching `\)`, and each `\[` has a matching `\]`. |
