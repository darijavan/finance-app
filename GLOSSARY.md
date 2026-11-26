# Finance App

Personal finance tracking for one person: money held in accounts, money coming in and going out, and plans for that money in the form of budgets, subscriptions and goals.

## Language

### Money and movements

**Account**:
A place where the user holds money in a single currency, such as a bank account, a card or cash.
_Avoid_: Wallet

**Transaction**:
Money entering or leaving the user's **Accounts** from outside, either as an expense or as income.
_Avoid_: Entry, movement

**Transfer**:
Money moved from one of the user's **Accounts** to another. It is never spending or income, and it is not a **Transaction**.
_Avoid_: Transfer transaction, internal transaction

**Category**:
A label for either expense **Transactions** or income **Transactions**, never both. A **Transaction** with no Category is shown as "Uncategorized", which is not itself a Category.
_Avoid_: Tag, type

**Receipt**:
A file, such as a photo or a PDF, attached to a **Transaction** as proof of it.
_Avoid_: Attachment, invoice

### Statement import

**Statement import**:
Bringing a bank or card statement into the app as new **Transactions**, after the user has reviewed each row.
_Avoid_: CSV upload, sync

**Merchant**:
The name of the other party to a **Transaction**, taken from its note with card suffixes and spacing removed.
_Avoid_: Payee, vendor

**Duplicate**:
A statement row that matches an existing **Transaction** on date, amount, direction and **Merchant**.
_Avoid_: Exact match

**Possible duplicate**:
A statement row that matches an existing **Transaction** on everything except the date, which is close but not the same.
_Avoid_: Fuzzy match, near-duplicate

### Currencies

**Base currency**:
The single currency in which the user sees totals across all **Accounts**.
_Avoid_: Display currency, home currency

**Entered amount**:
The amount of a **Transaction** or **Transfer**, in the currency it was entered in.
_Avoid_: Original amount, native amount

**Account amount**:
An **Entered amount** expressed in its **Account**'s currency at the exchange rate on the transaction date. It never changes afterwards.
_Avoid_: Converted amount

**Base value**:
An **Entered amount** expressed in the **Base currency** at the exchange rate on the transaction date, so past totals never change.
_Avoid_: Converted value, current value

### Reimbursements

**Reimbursable expense**:
An expense **Transaction** that someone else owes the user back. It still counts as spending.
_Avoid_: Claim, refundable

**Reimbursed**:
The state of a **Reimbursable expense** once the user confirms the money came back. Any repayment the user records is its own income **Transaction**.
_Avoid_: Refunded, settled

### Plans

**Subscription**:
A planned expense that repeats every month or every year.
_Avoid_: Recurring transaction, recurring payment

**Subscription charge**:
The expense **Transaction** recorded for one occurrence of a **Subscription**.
_Avoid_: Subscription payment

**Budget**:
A spending limit for one month, either for one **Category** or for all spending.
_Avoid_: Limit, allowance

**Rollover**:
The unused part of last month's **Budget** carried into this month's. An overspend is never carried forward.
_Avoid_: Carryover

**Recurring budget**:
A **Budget** that repeats into the months after the one it was set for. "Recurring" refers only to this.
_Avoid_: Repeating budget

**Monthly subscription total**:
The combined amount of all active monthly **Subscriptions**. Yearly ones are not included.
_Avoid_: Recurring monthly, recurring total

**Yearly subscription total**:
The combined amount of all active yearly **Subscriptions**.
_Avoid_: Annual commitments

**Goal**:
A target balance for one **Account**. Progress toward it is that **Account**'s whole balance.
_Avoid_: Savings target, envelope

### Feedback

**Activity**:
A record of one change the user made, such as adding a **Transaction** or editing a **Budget**. Some Activities can be undone.
_Avoid_: History entry, audit log

**Insight**:
An observation the app generates about a month's money, such as "the remaining **Subscriptions** would put this month in deficit".
_Avoid_: Tip, alert, notification
