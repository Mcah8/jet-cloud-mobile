# URL Structure — Jet Cloud Mobile

## Convention

All pages use the **folder + `index.html`** pattern so URLs are clean (no `.html` extension):

```
/page-name/index.html  →  jetcloudmobile.com.au/page-name
```

---

## Current URL Map

| URL | File path | Notes |
|-----|-----------|-------|
| `/` | `index.html` | Home |
| `/pricing` | `pricing.html` | *(legacy — migrate when next edited)* |
| `/faq` | `faq.html` | *(legacy)* |
| `/contact` | `contact.html` | *(legacy)* |
| `/articles` | `articles.html` | *(legacy)* |
| `/knowledgebase` | `knowledgebase.html` | *(legacy)* |

### /compare

| URL | File path |
|-----|-----------|
| `/compare/aircall` | `compare/aircall/index.html` |
| `/compare/dialpad` | `compare/dialpad/index.html` |
| `/compare/justcall` | `compare/justcall/index.html` |

### /solutions

| URL | File path |
|-----|-----------|
| `/solutions/sales-teams` | `solutions/sales-teams/index.html` |
| `/solutions/international-staff` | `solutions/international-staff/index.html` |
| `/solutions/small-business` | `solutions/small-business/index.html` |

### /industries

| URL | File path |
|-----|-----------|
| `/industries/automotive` | `industries/automotive/index.html` |
| `/industries/real-estate` | `industries/real-estate/index.html` |
| `/industries/finance` | `industries/finance/index.html` |

---

## Rules for new pages

1. **Always use a folder + `index.html`**, never a bare `page.html` file
2. **Folder names**: lowercase, hyphen-separated (`sales-teams` not `salesTeams`)
3. **Asset paths**: count your depth from root and use the right number of `../` steps:
   - 1 level deep (`/compare/aircall/index.html`) → `../../project/assets/`
   - 2 levels deep (`/solutions/sales-teams/index.html`) → `../../project/assets/` (same)
   - Root-level files (`index.html`) → `project/assets/`
4. **Internal links**: use root-relative or relative paths without `.html`:
   - Link to `/compare/dialpad` → `href="../../compare/dialpad"` or `href="/compare/dialpad"`
5. **Switcher / sibling links**: use `../sibling` when navigating between pages at the same depth level

---

## Adding a new compare page

```
compare/
  new-competitor/
    index.html        ← copy an existing compare page, update content
```

Asset path prefix: `../../`  
Switcher link to self: `href="../new-competitor" class="active"`  
Switcher links to siblings: `href="../aircall"`, `href="../dialpad"`, etc.
