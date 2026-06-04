"""
IRS tax form Pydantic schemas.

Each class mirrors the fields NuExtract will attempt to fill.
All fields use FieldResult so confidence + source metadata flows through
the same pipeline as USCIS forms.
"""

from __future__ import annotations

from pydantic import BaseModel

from models.schemas import FieldResult


# ---------------------------------------------------------------------------
# IRS Form 1040 — U.S. Individual Income Tax Return
# ---------------------------------------------------------------------------

class IRS1040(BaseModel):
    filing_status: FieldResult
    taxpayer_first_name: FieldResult
    taxpayer_last_name: FieldResult
    taxpayer_ssn: FieldResult
    spouse_first_name: FieldResult
    spouse_last_name: FieldResult
    spouse_ssn: FieldResult
    address: FieldResult
    city: FieldResult
    state: FieldResult
    zip_code: FieldResult
    total_income: FieldResult
    adjusted_gross_income: FieldResult
    taxable_income: FieldResult
    tax_owed: FieldResult
    total_tax_withheld: FieldResult
    refund_amount: FieldResult
    amount_owed: FieldResult
    tax_year: FieldResult


# ---------------------------------------------------------------------------
# W-2 — Wage and Tax Statement
# ---------------------------------------------------------------------------

class W2(BaseModel):
    employer_ein: FieldResult
    employer_name: FieldResult
    employer_address: FieldResult
    employee_ssn: FieldResult
    employee_first_name: FieldResult
    employee_last_name: FieldResult
    employee_address: FieldResult
    wages_tips: FieldResult
    federal_income_tax_withheld: FieldResult
    social_security_wages: FieldResult
    social_security_tax_withheld: FieldResult
    medicare_wages: FieldResult
    medicare_tax_withheld: FieldResult
    state: FieldResult
    state_income: FieldResult
    state_income_tax: FieldResult
    tax_year: FieldResult


# ---------------------------------------------------------------------------
# W-4 — Employee's Withholding Certificate
# ---------------------------------------------------------------------------

class W4(BaseModel):
    employee_first_name: FieldResult
    employee_last_name: FieldResult
    employee_ssn: FieldResult
    employee_address: FieldResult
    filing_status: FieldResult
    additional_withholding: FieldResult
    exempt_from_withholding: FieldResult
    tax_year: FieldResult


# ---------------------------------------------------------------------------
# 1099-NEC — Nonemployee Compensation
# ---------------------------------------------------------------------------

class F1099NEC(BaseModel):
    payer_name: FieldResult
    payer_tin: FieldResult
    payer_address: FieldResult
    recipient_name: FieldResult
    recipient_tin: FieldResult
    recipient_address: FieldResult
    nonemployee_compensation: FieldResult
    federal_income_tax_withheld: FieldResult
    state: FieldResult
    state_tax_withheld: FieldResult
    tax_year: FieldResult


# ---------------------------------------------------------------------------
# 1099-MISC — Miscellaneous Information
# ---------------------------------------------------------------------------

class F1099MISC(BaseModel):
    payer_name: FieldResult
    payer_tin: FieldResult
    payer_address: FieldResult
    recipient_name: FieldResult
    recipient_tin: FieldResult
    recipient_address: FieldResult
    rents: FieldResult
    royalties: FieldResult
    other_income: FieldResult
    federal_income_tax_withheld: FieldResult
    medical_healthcare_payments: FieldResult
    gross_proceeds_to_attorney: FieldResult
    tax_year: FieldResult


# ---------------------------------------------------------------------------
# 1099-INT — Interest Income
# ---------------------------------------------------------------------------

class F1099INT(BaseModel):
    payer_name: FieldResult
    payer_tin: FieldResult
    recipient_name: FieldResult
    recipient_tin: FieldResult
    interest_income: FieldResult
    early_withdrawal_penalty: FieldResult
    us_savings_bond_interest: FieldResult
    federal_income_tax_withheld: FieldResult
    investment_expenses: FieldResult
    tax_exempt_interest: FieldResult
    tax_year: FieldResult


# ---------------------------------------------------------------------------
# 1099-DIV — Dividends and Distributions
# ---------------------------------------------------------------------------

class F1099DIV(BaseModel):
    payer_name: FieldResult
    payer_tin: FieldResult
    recipient_name: FieldResult
    recipient_tin: FieldResult
    total_ordinary_dividends: FieldResult
    qualified_dividends: FieldResult
    capital_gain_distributions: FieldResult
    federal_income_tax_withheld: FieldResult
    exempt_interest_dividends: FieldResult
    tax_year: FieldResult


# ---------------------------------------------------------------------------
# Schedule A — Itemized Deductions
# ---------------------------------------------------------------------------

class ScheduleA(BaseModel):
    taxpayer_name: FieldResult
    taxpayer_ssn: FieldResult
    medical_dental_expenses: FieldResult
    state_local_taxes: FieldResult
    real_estate_taxes: FieldResult
    home_mortgage_interest: FieldResult
    charitable_contributions: FieldResult
    total_itemized_deductions: FieldResult
    tax_year: FieldResult


# ---------------------------------------------------------------------------
# Schedule C — Profit or Loss from Business
# ---------------------------------------------------------------------------

class ScheduleC(BaseModel):
    taxpayer_name: FieldResult
    taxpayer_ssn: FieldResult
    business_name: FieldResult
    business_ein: FieldResult
    principal_business: FieldResult
    gross_receipts: FieldResult
    total_expenses: FieldResult
    net_profit_loss: FieldResult
    tax_year: FieldResult


# ---------------------------------------------------------------------------
# Schedule D — Capital Gains and Losses
# ---------------------------------------------------------------------------

class ScheduleD(BaseModel):
    taxpayer_name: FieldResult
    taxpayer_ssn: FieldResult
    short_term_gains_losses: FieldResult
    long_term_gains_losses: FieldResult
    total_capital_gain_loss: FieldResult
    tax_year: FieldResult


# ---------------------------------------------------------------------------
# Registry  (metadata is registered in models.schemas to avoid circular import)
# ---------------------------------------------------------------------------

TAX_FORM_SCHEMAS: dict[str, type] = {
    "IRS-1040":   IRS1040,
    "W-2":        W2,
    "W-4":        W4,
    "1099-NEC":   F1099NEC,
    "1099-MISC":  F1099MISC,
    "1099-INT":   F1099INT,
    "1099-DIV":   F1099DIV,
    "Schedule-A": ScheduleA,
    "Schedule-C": ScheduleC,
    "Schedule-D": ScheduleD,
}
