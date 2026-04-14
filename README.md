# Shopify Theme

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/rinaldoevosem/zoe-test.git
cd zoe-test
```

---

### 2. Install Shopify CLI

Follow the official instructions:
https://shopify.dev/docs/apps/tools/cli

---

### 3. Login to your store

```bash
shopify login --store=zoe-test-1-0.myshopify.com
```

---

### 4. Run the theme locally

```bash
shopify theme dev
```

This will generate a preview URL and enable live updates.

---

### 5. Deploy changes

```bash
shopify theme push
```
