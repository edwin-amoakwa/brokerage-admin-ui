/**
 * The admin sidebar. Same groups and labels as the JSF menu
 * (secured/menus/app-menues.xhtml). Each `permission` is a page key from the
 * backend's AdminPages; routes use the same key with "/" for ".".
 */
export interface MenuItem {
  label: string;
  route: string;
  /** PrimeIcons class shown beside the label. */
  icon: string;
  permission: string;
}

export interface MenuGroup {
  label: string;
  icon: string;
  items: MenuItem[];
}

export const MENU: MenuGroup[] = [
  {
    "label": "Dashboard",
    "icon": "pi pi-home",
    "items": [
      {
        "label": "Dashboard",
        "route": "/dashboard",
        "icon": "pi pi-home",
        "permission": "dashboard"
      }
    ]
  },
  {
    "label": "Accounts",
    "icon": "pi pi-users",
    "items": [
      {
        "label": "Accounts Dashboard",
        "route": "/accounts/dashboard",
        "icon": "pi pi-objects-column",
        "permission": "accounts.dashboard"
      },
      {
        "label": "Investors",
        "route": "/accounts/investors",
        "icon": "pi pi-users",
        "permission": "accounts.investors"
      },
      {
        "label": "Incomplete Registrations",
        "route": "/accounts/incomplete-registrations",
        "icon": "pi pi-user-minus",
        "permission": "accounts.incomplete-registrations"
      },
      {
        "label": "Investor Verifications",
        "route": "/accounts/verifications",
        "icon": "pi pi-verified",
        "permission": "accounts.verifications"
      },
      {
        "label": "Account Creation",
        "route": "/accounts/account-creation",
        "icon": "pi pi-user-plus",
        "permission": "accounts.account-creation"
      },
      {
        "label": "Accounts",
        "route": "/accounts/accounts",
        "icon": "pi pi-id-card",
        "permission": "accounts.accounts"
      },
      {
        "label": "Account Portfolio",
        "route": "/accounts/portfolio",
        "icon": "pi pi-briefcase",
        "permission": "accounts.portfolio"
      },
      {
        "label": "Beneficiaries",
        "route": "/accounts/beneficiaries",
        "icon": "pi pi-heart",
        "permission": "accounts.beneficiaries"
      },
      {
        "label": "Investor Risk Assessment",
        "route": "/accounts/risk-assessments",
        "icon": "pi pi-gauge",
        "permission": "accounts.risk-assessments"
      },
      {
        "label": "Account Utilities",
        "route": "/accounts/utilities",
        "icon": "pi pi-key",
        "permission": "accounts.utilities"
      }
    ]
  },
  {
    "label": "Equities",
    "icon": "pi pi-chart-line",
    "items": [
      {
        "label": "Orders",
        "route": "/equities/orders",
        "icon": "pi pi-shopping-cart",
        "permission": "equities.orders"
      },
      {
        "label": "Upload Stock Orders",
        "route": "/equities/order-upload",
        "icon": "pi pi-cloud-upload",
        "permission": "equities.order-upload"
      },
      {
        "label": "Working Orders",
        "route": "/equities/working-orders",
        "icon": "pi pi-sync",
        "permission": "equities.working-orders"
      },
      {
        "label": "Order Batching",
        "route": "/equities/order-batches",
        "icon": "pi pi-objects-column",
        "permission": "equities.order-batches"
      },
      {
        "label": "Execution Processing",
        "route": "/equities/execution-processing",
        "icon": "pi pi-cog",
        "permission": "equities.execution-processing"
      },
      {
        "label": "Trade Records",
        "route": "/equities/trades",
        "icon": "pi pi-book",
        "permission": "equities.trades"
      },
      {
        "label": "Equity Transactions",
        "route": "/equities/executions",
        "icon": "pi pi-list-check",
        "permission": "equities.executions"
      },
      {
        "label": "Dividends",
        "route": "/equities/dividends",
        "icon": "pi pi-money-bill",
        "permission": "equities.dividends"
      },
      {
        "label": "Dividend Processing",
        "route": "/equities/dividend-processing",
        "icon": "pi pi-calculator",
        "permission": "equities.dividend-processing"
      },
      {
        "label": "Bonus Shares",
        "route": "/equities/bonus-issues",
        "icon": "pi pi-gift",
        "permission": "equities.bonus-issues"
      },
      {
        "label": "Bonus Processing",
        "route": "/equities/bonus-processing",
        "icon": "pi pi-sparkles",
        "permission": "equities.bonus-processing"
      }
    ]
  },
  {
    "label": "Fixed Income",
    "icon": "pi pi-percentage",
    "items": [
      {
        "label": "Orders",
        "route": "/fixed-income/orders",
        "icon": "pi pi-shopping-cart",
        "permission": "fixed-income.orders"
      },
      {
        "label": "Working Transactions",
        "route": "/fixed-income/working-orders",
        "icon": "pi pi-sync",
        "permission": "fixed-income.working-orders"
      },
      {
        "label": "Order Batching",
        "route": "/fixed-income/order-batches",
        "icon": "pi pi-objects-column",
        "permission": "fixed-income.order-batches"
      },
      {
        "label": "Execution Processing",
        "route": "/fixed-income/execution-processing",
        "icon": "pi pi-cog",
        "permission": "fixed-income.execution-processing"
      },
      {
        "label": "Trade",
        "route": "/fixed-income/trades",
        "icon": "pi pi-book",
        "permission": "fixed-income.trades"
      },
      {
        "label": "Simple Transaction",
        "route": "/fixed-income/simple-transactions",
        "icon": "pi pi-file-edit",
        "permission": "fixed-income.simple-transactions"
      },
      {
        "label": "Fixed Income Redemption",
        "route": "/fixed-income/redemptions",
        "icon": "pi pi-replay",
        "permission": "fixed-income.redemptions"
      }
    ]
  },
  {
    "label": "Cash Transactions",
    "icon": "pi pi-wallet",
    "items": [
      {
        "label": "Cash Transactions",
        "route": "/cash/transactions",
        "icon": "pi pi-wallet",
        "permission": "cash.transactions"
      }
    ]
  },
  {
    "label": "Transaction History",
    "icon": "pi pi-history",
    "items": [
      {
        "label": "Account Transactions",
        "route": "/history/account-transactions",
        "icon": "pi pi-list",
        "permission": "history.account-transactions"
      },
      {
        "label": "Fixed Income Transaction History",
        "route": "/history/fixed-income-transactions",
        "icon": "pi pi-percentage",
        "permission": "history.fixed-income-transactions"
      },
      {
        "label": "Cash Transaction History",
        "route": "/history/cash-transactions",
        "icon": "pi pi-money-bill",
        "permission": "history.cash-transactions"
      }
    ]
  },
  {
    "label": "Client Care",
    "icon": "pi pi-comments",
    "items": [
      {
        "label": "Cases",
        "route": "/support/cases",
        "icon": "pi pi-ticket",
        "permission": "support.cases"
      },
      {
        "label": "Contact Log",
        "route": "/support/interactions",
        "icon": "pi pi-phone",
        "permission": "support.interactions"
      }
    ]
  },
  {
    "label": "Reports",
    "icon": "pi pi-file-pdf",
    "items": [
      {
        "label": "Reports",
        "route": "/reports",
        "icon": "pi pi-file-pdf",
        "permission": "reports"
      }
    ]
  },
  {
    "label": "System Admin",
    "icon": "pi pi-cog",
    "items": [
      {
        "label": "User Accounts",
        "route": "/admin/users",
        "icon": "pi pi-user",
        "permission": "admin.users"
      },
      {
        "label": "Roles",
        "route": "/admin/roles",
        "icon": "pi pi-lock",
        "permission": "admin.roles"
      },
      {
        "label": "Risk Levels",
        "route": "/admin/risk-levels",
        "icon": "pi pi-sliders-h",
        "permission": "admin.risk-levels"
      },
      {
        "label": "Countries",
        "route": "/admin/countries",
        "icon": "pi pi-globe",
        "permission": "admin.countries"
      },
      {
        "label": "Registrars",
        "route": "/admin/registrars",
        "icon": "pi pi-address-book",
        "permission": "admin.registrars"
      },
      {
        "label": "Industries",
        "route": "/admin/industries",
        "icon": "pi pi-building",
        "permission": "admin.industries"
      },
      {
        "label": "Case Categories",
        "route": "/admin/case-categories",
        "icon": "pi pi-sitemap",
        "permission": "admin.case-categories"
      },
      {
        "label": "Case Teams",
        "route": "/admin/case-teams",
        "icon": "pi pi-users",
        "permission": "admin.case-teams"
      },
      {
        "label": "Stock Exchanges",
        "route": "/admin/stock-exchanges",
        "icon": "pi pi-building-columns",
        "permission": "admin.stock-exchanges"
      },
      {
        "label": "Stocks",
        "route": "/admin/stocks",
        "icon": "pi pi-chart-line",
        "permission": "admin.stocks"
      },
      {
        "label": "Equity Market Prices",
        "route": "/admin/equity-prices",
        "icon": "pi pi-tag",
        "permission": "admin.equity-prices"
      },
      {
        "label": "Fee Types",
        "route": "/admin/fee-types",
        "icon": "pi pi-receipt",
        "permission": "admin.fee-types"
      },
      {
        "label": "Exchange Fees",
        "route": "/admin/exchange-fees",
        "icon": "pi pi-dollar",
        "permission": "admin.exchange-fees"
      },
      {
        "label": "Security Issuers",
        "route": "/admin/security-issuers",
        "icon": "pi pi-building-columns",
        "permission": "admin.security-issuers"
      },
      {
        "label": "Fixed Income Securities",
        "route": "/admin/fixed-income-securities",
        "icon": "pi pi-file",
        "permission": "admin.fixed-income-securities"
      },
      {
        "label": "Fixed Income Market Prices",
        "route": "/admin/fixed-income-prices",
        "icon": "pi pi-chart-scatter",
        "permission": "admin.fixed-income-prices"
      },
      {
        "label": "Bank Accounts",
        "route": "/admin/bank-accounts",
        "icon": "pi pi-credit-card",
        "permission": "admin.bank-accounts"
      },
      {
        "label": "Banks",
        "route": "/admin/banks",
        "icon": "pi pi-building-columns",
        "permission": "admin.banks"
      },
      {
        "label": "Bank Branches",
        "route": "/admin/bank-branches",
        "icon": "pi pi-map-marker",
        "permission": "admin.bank-branches"
      },
      {
        "label": "Risk Assessment Questions",
        "route": "/admin/risk-questions",
        "icon": "pi pi-question-circle",
        "permission": "admin.risk-questions"
      },
      {
        "label": "Notifications",
        "route": "/admin/notifications",
        "icon": "pi pi-bell",
        "permission": "admin.notifications"
      },
      {
        "label": "Messaging Templates",
        "route": "/admin/messaging-templates",
        "icon": "pi pi-envelope",
        "permission": "admin.messaging-templates"
      }
    ]
  }
];
