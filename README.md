# OMR Practice Portal: setup guide

This guide assumes no programming experience. Follow the parts in order. The whole setup takes about an hour the first time.

## What is in this folder

| File | What it is | Where it goes |
|---|---|---|
| `config.js` | **Your settings** (backend link, book name, helpline). The only file you edit. | GitHub |
| `index.html` | The student portal (the website). | GitHub |
| `admin.html` | The admin portal: books, exams, questions, results, book IDs, students, settings, admins. | GitHub |
| `print.html` | A tool for you that prints question papers, answer keys, solutions and OMR sheets. | GitHub |
| `omr-draw.js` | Draws the OMR sheet; used by `omr-sheet.html` and `print.html`. | GitHub |
| `generator.html` | A tool for you that turns book IDs into printable QR codes. | GitHub |
| `omr-sheet.html` | A tool for you that makes the printable A5 OMR answer sheet for each exam. | GitHub |
| `omr-scan.js`, `omr-layout.js` | The camera scanner, used by `index.html`. | GitHub |
| `Code.gs` | The "brain": checks answers, locks main attempts, keeps scores. | Google Sheets (Apps Script) |
| `README.md` | This guide. | GitHub (optional) |

**How the pieces fit:** students open your website (hosted free on GitHub Pages). The website sends their answers to a small program inside your Google Sheet. That program checks them against the answer key, which stays private in your sheet, and sends back the result and solutions.

---

## Upgrading to the admin portal (version 2)

If you already set up the portal with the earlier version, do this once. Nothing is lost: books, questions, students and results are kept.

1. In Apps Script, replace everything with the new `Code.gs`, click **Save**.
2. Reload the Google Sheet and click **OMR Portal > 1. Set up / upgrade sheets**. It adds new tabs (**Titles, Subjects, Admins, Log**) and new columns, puts your existing exams into one book called "আমার বই" (rename it in the admin portal), and shows an **admin setup code**.
3. **Deploy > Manage deployments > ✏️ > Version: New version > Deploy.**
4. Upload `admin.html` and the new `index.html` to GitHub.
5. Open `your-site/admin.html`, enter the setup code, and create your super admin account. The code works only once; you can see it again with **OMR Portal > Show admin setup code** until the first admin exists.

### What's in the admin portal

| Page | Who | What it does |
|---|---|---|
| **Books & exams** | All admins | Add books (what you publish), subjects and exams. Per-exam marking, open/hidden. |
| **Questions** | All admins | Pick an exam, then add, edit, reorder or delete questions. The editor has buttons for common math (fraction, power, √, θ…) and a live preview of exactly what students see. |
| **Results** | All admins (phone numbers: super admin only) | **By exam:** students, average, highest, lowest, a chart of how marks are spread, and for every question the % who got it right and how many picked each option. **Book ranking:** the full ranking for a book. **One student:** every exam they took, with their answer and the correct answer for each question. Everything can be downloaded as Excel. |
| **Print papers** | All admins | Opens the printing tool (question papers, answer keys, solutions, OMR sheets) without a separate sign-in. |
| **OMR sheet maker** | All admins | Single OMR sheets for your book designer. |
| **Book IDs & QR** | Super admin | Make IDs for a print run, then print QR labels or download Excel/CSV for your printer. Browse all IDs by book or batch; block or unblock a copy. |
| **Students** | Super admin | Search by name, phone, institution or book ID; open their results; reset a forgotten PIN; block. |
| **Settings** | Super admin | Website address, default marking, show/hide the top list and its size, recalculate all scores. |
| **Admins / Activity log / My account** | As before | Manage admins, see who changed what, change your password. |

**Questions after students have submitted:** once an exam has student results, you can still fix the wording or the correct answer (scores for that exam are recalculated automatically), but you can't add, remove or reorder questions, because students' saved answers are matched by question number.

**Admin preview books:** to try exams as a student would (including hidden ones), set a book ID's status to admin preview in the Books tab (`ADMIN`). Its submissions are never saved or ranked.

Word upload and picture upload are in the next update. Until then, add pictures by uploading them to the `images` folder on GitHub and typing the file name in the question editor.

---

## Part 1: Set up the Google Sheet (the backend)

Use a Google account that belongs to your business, because this account will own all student data.

1. Go to [sheets.google.com](https://sheets.google.com) and create a **blank spreadsheet**. Name it something like `OMR Portal`.
2. In the menu, click **Extensions > Apps Script**. A code editor opens in a new tab.
3. Delete everything in the editor. Open `Code.gs` from this folder in Notepad (or any text editor), copy **all** of it, and paste it in.
4. Click the **Save** icon (💾). Rename the project at the top-left to `OMR Portal`.
5. Go back to the spreadsheet tab and **reload the page**. After a few seconds a new menu called **OMR Portal** appears next to Help.
6. Click **OMR Portal > 1. Set up / upgrade sheets**.
7. Google asks for permission:
   - Click **Continue** and choose your account.
   - You'll see "Google hasn't verified this app". This is normal for your own script. Click **Advanced > Go to OMR Portal (unsafe)**, then **Allow**.
   - Run **OMR Portal > 1. Set up / upgrade sheets** again if nothing happened the first time.
8. You now have these tabs: **Titles, Subjects, Exams, Questions, Books, Attempts, Admins, Log, Settings**. A sample book with the physics exam (PHY-01, 20 questions) and three test copies (`DEMO-0001`, `DEMO-0002`, `DEMO-0003`) are already filled in. A message shows your **admin setup code**; you'll use it in `admin.html` to create your super admin.

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

### Edit your settings in `config.js`

1. Open `config.js` in Notepad. It looks like this:

   ```js
   window.PORTAL_CONFIG = {
     API_URL: 'PASTE_YOUR_WEB_APP_URL_HERE',
     SITE_NAME: 'পদার্থবিজ্ঞান অনুশীলন বই',
     SUPPORT_CONTACT: 'প্রকাশকের হেল্পলাইন: 01XXXXXXXXX',
     IMAGE_FOLDER: 'images/',
   };
   ```

2. Replace `PASTE_YOUR_WEB_APP_URL_HERE` with the `/exec` URL from Part 1. Keep the quote marks, and keep it all on one line.
3. Change `SITE_NAME` to your book or brand name, and `SUPPORT_CONTACT` to your helpline. Save the file.

Because your settings live only in `config.js`, you can replace `index.html` and the other files with newer versions later without copying anything over. You can also edit `config.js` directly on GitHub with the pencil ✏️ button.

### Upload to GitHub

4. Create a free account at [github.com](https://github.com) if you don't have one.
5. Click **+ > New repository**. Name it, for example, `exam-portal`. Choose **Public** (free GitHub Pages needs a public repository; this is safe because no answers or student data are in these files). Click **Create repository**.
6. Click **uploading an existing file**, drag in **all the files from this folder** (`config.js`, `index.html`, `print.html`, `generator.html`, `omr-sheet.html`, `omr-draw.js`, `omr-scan.js`, `omr-layout.js`, `README.md`; everything except `Code.gs`), then click **Commit changes**. They must all sit together in the top level of the repository.
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

When you're happy, **delete the DEMO rows** you don't need from the Books tab (and their rows from Attempts) before selling books. You can keep one as your private admin preview book (Part 8).

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
| ImageURL | Optional picture shown under the question (see "Adding images"). |
| OptionA–OptionD | The four options (ক, খ, গ, ঘ). |
| Answer | The correct option: `ক`, `খ`, `গ`, `ঘ` (or `A`–`D`). |
| Solution | The detailed solution. |
| SolutionImage | Optional picture shown at the end of the solution. |

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

### Adding images

A picture can go in three places:

- **Under the question:** put it in the **ImageURL** column.
- **At the end of the solution:** put it in the **SolutionImage** column.
- **Anywhere inside text** (question, any option, or solution): type `[img:file-name.png]` on its own line where the picture should appear. Use this when a solution needs a diagram in the middle, or when the options themselves are graphs.

In each of those places you can write any of these:

| You write | Where the picture lives |
|---|---|
| `phy01-q14.png` | In the `images` folder of your GitHub repository (recommended). |
| `https://…/picture.png` | Any public web address. |
| A Google Drive share link | Google Drive, shared as "Anyone with the link". Works today, but Google doesn't officially support showing Drive files on other websites, so prefer GitHub for printed books. |

**Uploading pictures to GitHub (recommended):**

1. On your computer, make a folder named `images` and put your pictures in it.
2. Name the files simply, with no spaces or Bengali letters, for example `phy01-q14.png`, `phy01-q14-sol.png`. Including the exam ID and question number makes them easy to find.
3. In your GitHub repository, click **Add file > Upload files** and drag the **whole `images` folder** in. Click **Commit changes**.
4. To add more later, open the `images` folder on GitHub and use **Add file > Upload files** there.
5. In the sheet, type just the file name, e.g. `phy01-q14.png`.

**Picture tips:**
- Use **PNG** for diagrams and **JPG** for photos. Keep each file under about 300 KB, around 1000–1400 pixels wide. Free tool: [squoosh.app](https://squoosh.app).
- Diagrams always show on a white background, so they stay readable when a student's phone is in dark mode.
- Students can tap any picture to open it full screen, and tap again to zoom in.
- If a file name is wrong or the file is missing, the portal shows "ছবিটি লোড হয়নি: file-name" in red in place of the picture. Check this with an admin preview book (Part 8) before opening an exam.

**If your Questions tab was created before images were added:** type `SolutionImage` in the first empty header cell of row 1 (any column works). Also paste the newest `Code.gs` into Apps Script and deploy a **New version** (see the note at the end of Part 1).

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

## Part 6: OMR sheets and camera scanning

Students can either scan their filled OMR page with the phone camera or tap the bubbles by hand. Scanning only works on sheets made with `omr-sheet.html`, because the scanner knows exactly where every bubble is on that design.

### Make the sheet for each exam

1. Open `https://exam.yourdomain.com/omr-sheet.html`. The **Website address** box fills itself in with your site's address. Check it's the address students will use (your own domain once connected, Part 2).
2. Fill in the Exam ID (exactly as in the Exams tab), exam name, number of questions and book name. The sheet is **A5 (148 × 210 mm)** and holds up to **60 questions**.
3. Choose the bubble ink:
   - **Pink** if the OMR pages are printed in colour (recommended).
   - **Light grey** if the book is printed in black and white.
4. Click **Print or save as PDF** (choose "Save as PDF" as the printer) and give the PDF to your book designer. **Download SVG** gives the same page for design software.
5. Make one sheet per exam. Each sheet has a small QR code that does two jobs:
   - **Scanning it with any phone camera opens that exam's answer page directly** (the link looks like `https://exam.yourdomain.com/?e=PHY-01&q=20`). The first time on a phone, the student is asked for their book ID and PIN; after that it opens straight away.
   - It tells the camera scanner which exam the page belongs to, so a student can't submit the wrong exam's sheet by mistake.

   Because the link is printed, make the final sheets only after your own domain is connected, just like the book QR codes.

The number of questions on the sheet must match the number of questions for that exam in the Questions tab. If you later add or remove a question, make a new sheet.

### Printing rules

- **Paper size:** the sheet is A5, the usual size for a practice book page. To test-print at home on A4 paper, print at "Actual size"; scaling the whole page evenly is also fine.
- **Don't change the design** in the book layout: no resizing of only part of it, no moving bubbles, nothing printed over or next to the four black corner squares. Scaling the whole page evenly (for example to fit a smaller book size) is fine.
- The four corner squares must print **solid black**.
- Use plain white or off-white **matte paper**. Glossy paper reflects light into the camera.
- **Binding matters.** A page that curves into the spine reads badly. The best option is perforated tear-out OMR pages. Otherwise, give the OMR pages a wide inner margin so they lie flat.
- Before the print run, print one page at home, fill it, and scan it with your admin preview book.

### What students do

1. Fill the OMR page in the book with a black or blue pen, or an HB/2B pencil.
2. Scan the small QR code on the OMR page with the phone camera (or open the exam from the portal's list), then tap **ক্যামেরা দিয়ে OMR স্ক্যান করুন** to read the whole page.
3. Hold the phone over the page so all four corner squares are visible. A green frame appears when the page is found; the scanner waits until the phone is steady and reads it automatically. Other buttons on the scan screen:
   - **এখনই পড়ুন** reads immediately.
   - **টর্চ** turns on the phone's flashlight (shown only on phones that allow it).
   - **ক্যামেরা অ্যাপে ছবি তুলুন** opens the phone's own camera app. This gives the sharpest picture (proper autofocus, flash, HDR), so it's the best choice in poor light or if the live scan struggles.
   - **গ্যালারি থেকে** uses a photo already taken.
4. The answers appear on screen. Any question the scanner isn't sure about (two bubbles filled, a very light mark, or an erased mark) is highlighted in yellow for the student to check against the paper.
5. The student checks, fixes anything, and submits as usual.

**Scanning conditions:** the scanner compares pencil marks with the printed black corner squares in the same photo, and measures the paper's brightness next to every bubble. So dim light, yellow bulbs, and shadows across the page are handled; it doesn't need perfect light. What still causes trouble: a bright reflection (glare) over the bubbles, a page curving into the spine, and very faint pencil. Anything uncertain is highlighted for the student to check. The live camera needs a normal browser such as Chrome; some apps' built-in browsers (Facebook, Messenger) block it, but **ক্যামেরা অ্যাপে ছবি তুলুন** still works there.

**Old sheets:** sheets printed from the earlier A4 design won't scan any more; the scanner says so. Print new sheets from `omr-sheet.html`.

**What scanning doesn't change:** students can still correct answers before submitting, so scanning is a convenience, not proof of what was on paper. Your top-100 competition should still be a supervised exam.

---

## Part 7: Printing question papers

`print.html` turns the exams in your Google Sheet into print-ready pages, using exactly the questions, math and pictures students see in the portal. Use it to make the book's question papers, a teacher's answer key, and a solutions section.

1. Make sure one book has **Status `ADMIN`** in the Books tab and is registered with a PIN (open the portal once with that book ID). Part 8 explains admin books.
2. Open `https://exam.yourdomain.com/print.html` and sign in with that book ID and PIN.
3. Tick the exams to print. **Select all** prints the whole book in one go. Tick "Include exams that are still hidden" to print papers before they open to students.
4. Choose the options:
   - **Paper size:** A5 (same as the OMR sheet) or A4.
   - **Questions per page:** one or two columns. Two columns suit A4.
   - **Text size** and **time** (the time is printed in each paper's header; leave it blank to hide it).
   - **Answer key:** none, after each paper, or all together at the end.
   - **Detailed solutions:** none, after each paper, or all together at the end.
   - **OMR sheet:** prints the matching A5 OMR sheet right after each paper, so one PDF can be the whole inside of the book.
   - **Small QR code on each paper:** opens that exam in the portal, the same link as the OMR sheet's QR.
5. Click **Make papers**, check the preview, then **Print or save as PDF**. In the print window, choose "Save as PDF", set margins to **Default**, and turn **Headers and footers off**. Page numbers are added automatically.

Each paper shows the book name, exam name, exam code, number of questions, full marks and the marking rule (from `MARK_CORRECT` and `MARK_WRONG` in Settings). Options are laid out four, two or one per line depending on how long they are. A missing picture shows as red text in the preview, so you can fix it before printing.

**For the student book,** print the papers and OMR sheets without the answer key or solutions. For a teacher's edition or an answer booklet, print again with the key and solutions turned on.

**After updating:** this tool needs the newest `Code.gs`. Paste it into Apps Script and deploy a **New version** (Part 1). If the tool says "Your Apps Script is an old version", that step was missed.

---

## Part 8: Running the portal

**A student forgot their PIN.** Confirm it's really them (for example, they call from the registered phone). In the Books tab, clear their **PinHash** cell. When they open the portal, it asks for their registered phone number and a new PIN.

**Block a book** (for example, a pirated copy). Set its **Status** to `BLOCKED`.

**Preview exams before students see them.** Set one book's **Status** to `ADMIN` (for example `DEMO-0001`). That book sees every exam, including ones whose Open box is unticked, so you can check questions, math and pictures. It never saves marks and never appears on the top list. Keep its ID private.

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
| "Portal setup is not finished: paste the Apps Script Web app URL…" | `API_URL` in `config.js` is not set, or `config.js` isn't uploaded. The message shows what the page currently sees. See Part 2. |
| "সার্ভারের সাথে সংযোগ হয়নি" for everyone | Check the deployment has **Who has access: Anyone**, and that the URL ends with `/exec`. |
| You changed `Code.gs` but nothing changed | Deploy a **New version** (see the note at the end of Part 1). |
| "Server setup is not finished…" | Run **OMR Portal > 1. Set up / upgrade sheets**. Don't rename the tabs or the header row. |
| The website doesn't show your latest edit | GitHub takes about a minute. Then refresh the page (on phone, close and reopen the tab). |
| Math shows as `\(...\)` text | Check each `\(` has a matching `\)`, and each `\[` has a matching `\]`. |
