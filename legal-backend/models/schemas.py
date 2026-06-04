from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class Source(str, Enum):
    native = "native"
    llm = "llm"
    human = "human"


class FieldResult(BaseModel):
    value: Optional[str] = None
    confidence: float = Field(ge=0.0, le=1.0)
    source: Source


# ---------------------------------------------------------------------------
# Shared "Receipt record" fields — attached to every form schema.
# Populated by intelligence.receipt_fields.extract_receipt_fields().
# ---------------------------------------------------------------------------

class ReceiptFieldsMixin(BaseModel):
    primary_flag: FieldResult
    sent_government_agency: FieldResult
    receipt_for: FieldResult
    receipt_type: FieldResult
    receipt_date: FieldResult
    receipt_notice_date: FieldResult
    receipt_number: FieldResult
    receipt_status: FieldResult
    expiration_alert: FieldResult
    receipt_notes: FieldResult


# Instructor response model for the LLM receipt-extraction pass. Each field is
# paired with a *_confidence float, matching the per-form *LLM schemas, so the
# generic _merge() in llm_fallback can fold the results back in.
class NoticeReceiptLLMExtract(BaseModel):
    primary_flag: Optional[str] = None
    primary_flag_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    sent_government_agency: Optional[str] = None
    sent_government_agency_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    receipt_for: Optional[str] = None
    receipt_for_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    receipt_type: Optional[str] = None
    receipt_type_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    receipt_date: Optional[str] = None
    receipt_date_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    receipt_notice_date: Optional[str] = None
    receipt_notice_date_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    receipt_number: Optional[str] = None
    receipt_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    receipt_status: Optional[str] = None
    receipt_status_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    expiration_alert: Optional[str] = None
    expiration_alert_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    receipt_notes: Optional[str] = None
    receipt_notes_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Structured form schemas (one FieldResult per logical field)
# ---------------------------------------------------------------------------

class I485(ReceiptFieldsMixin):
    alien_registration_number: FieldResult
    family_name: FieldResult
    given_name: FieldResult
    date_of_birth: FieldResult
    country_of_birth: FieldResult
    date_of_entry: FieldResult
    class_of_admission: FieldResult
    ssn: FieldResult


class N400(ReceiptFieldsMixin):
    family_name: FieldResult
    given_name: FieldResult
    date_of_birth: FieldResult
    country_of_birth: FieldResult
    alien_registration_number: FieldResult
    date_became_pr: FieldResult
    marital_status: FieldResult


class I129(ReceiptFieldsMixin):
    petitioner_name: FieldResult
    petitioner_ein: FieldResult
    beneficiary_name: FieldResult
    beneficiary_alien_number: FieldResult
    nonimmigrant_classification: FieldResult
    period_of_stay_requested: FieldResult
    job_title: FieldResult
    wage_rate_of_pay: FieldResult


class I140(ReceiptFieldsMixin):
    petitioner_name: FieldResult
    petitioner_ein: FieldResult
    beneficiary_name: FieldResult
    beneficiary_alien_number: FieldResult
    preference_classification: FieldResult
    priority_date: FieldResult
    job_title: FieldResult
    offered_wage: FieldResult


class I797(ReceiptFieldsMixin):
    receipt_number: FieldResult
    notice_type: FieldResult
    applicant_name: FieldResult
    alien_registration_number: FieldResult
    case_type: FieldResult
    notice_date: FieldResult
    validity_start: FieldResult
    validity_end: FieldResult
    action_taken: FieldResult


class I751(ReceiptFieldsMixin):
    alien_registration_number: FieldResult
    family_name: FieldResult
    given_name: FieldResult
    date_of_birth: FieldResult
    country_of_birth: FieldResult
    joint_petitioner_name: FieldResult
    date_card_expires: FieldResult
    basis_for_petition: FieldResult


class I130(ReceiptFieldsMixin):
    petitioner_family_name: FieldResult
    petitioner_given_name: FieldResult
    petitioner_dob: FieldResult
    petitioner_alien_number: FieldResult
    relationship_to_beneficiary: FieldResult
    beneficiary_family_name: FieldResult
    beneficiary_given_name: FieldResult
    beneficiary_dob: FieldResult
    beneficiary_country_of_birth: FieldResult


class I131(ReceiptFieldsMixin):
    family_name: FieldResult
    given_name: FieldResult
    alien_registration_number: FieldResult
    date_of_birth: FieldResult
    class_of_admission: FieldResult
    date_of_admission: FieldResult
    country_of_birth: FieldResult
    travel_document_type: FieldResult
    reason_for_travel: FieldResult


class I539(ReceiptFieldsMixin):
    family_name: FieldResult
    given_name: FieldResult
    alien_registration_number: FieldResult
    date_of_birth: FieldResult
    country_of_birth: FieldResult
    current_nonimmigrant_status: FieldResult
    status_expires: FieldResult
    requested_status: FieldResult


class I765(ReceiptFieldsMixin):
    family_name: FieldResult
    given_name: FieldResult
    alien_registration_number: FieldResult
    date_of_birth: FieldResult
    country_of_birth: FieldResult
    ssn: FieldResult
    eligibility_category: FieldResult
    date_eligibility_expires: FieldResult


class I290B(ReceiptFieldsMixin):
    receipt_number: FieldResult
    form_type_appealed: FieldResult
    applicant_name: FieldResult
    alien_registration_number: FieldResult
    date_of_decision: FieldResult
    reason_for_appeal: FieldResult
    brief_attached: FieldResult


class I129F(ReceiptFieldsMixin):
    petitioner_family_name: FieldResult
    petitioner_given_name: FieldResult
    petitioner_dob: FieldResult
    beneficiary_family_name: FieldResult
    beneficiary_given_name: FieldResult
    beneficiary_dob: FieldResult
    beneficiary_country_of_birth: FieldResult
    date_met_beneficiary: FieldResult
    prior_petitions: FieldResult


class N600(ReceiptFieldsMixin):
    family_name: FieldResult
    given_name: FieldResult
    date_of_birth: FieldResult
    country_of_birth: FieldResult
    alien_registration_number: FieldResult
    us_citizen_parent_name: FieldResult
    parent_citizenship_date: FieldResult
    basis_for_citizenship: FieldResult


class I485SuppJ(ReceiptFieldsMixin):
    alien_registration_number: FieldResult
    family_name: FieldResult
    given_name: FieldResult
    principal_applicant_name: FieldResult
    job_offer_employer: FieldResult
    job_offer_title: FieldResult
    job_offer_soc_code: FieldResult
    portability_claim: FieldResult


class I824(ReceiptFieldsMixin):
    alien_registration_number: FieldResult
    family_name: FieldResult
    given_name: FieldResult
    original_form_type: FieldResult
    original_receipt_number: FieldResult
    original_approval_date: FieldResult
    action_requested: FieldResult


class I90(ReceiptFieldsMixin):
    alien_registration_number: FieldResult
    family_name: FieldResult
    given_name: FieldResult
    date_of_birth: FieldResult
    country_of_birth: FieldResult
    card_expiration_date: FieldResult
    reason_for_replacement: FieldResult


# ---------------------------------------------------------------------------
# Flat LLM extraction schemas
# Each field is a plain str (nullable) with a paired _confidence float.
# narrative_flags collects free-text anomaly/flag notes from the LLM.
# ---------------------------------------------------------------------------

class I485LLM(BaseModel):
    alien_registration_number: Optional[str] = None
    alien_registration_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    family_name: Optional[str] = None
    family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    given_name: Optional[str] = None
    given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_of_birth: Optional[str] = None
    date_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    country_of_birth: Optional[str] = None
    country_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_of_entry: Optional[str] = None
    date_of_entry_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    class_of_admission: Optional[str] = None
    class_of_admission_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    ssn: Optional[str] = None
    ssn_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class N400LLM(BaseModel):
    family_name: Optional[str] = None
    family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    given_name: Optional[str] = None
    given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_of_birth: Optional[str] = None
    date_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    country_of_birth: Optional[str] = None
    country_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    alien_registration_number: Optional[str] = None
    alien_registration_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_became_pr: Optional[str] = None
    date_became_pr_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    marital_status: Optional[str] = None
    marital_status_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I129LLM(BaseModel):
    petitioner_name: Optional[str] = None
    petitioner_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    petitioner_ein: Optional[str] = None
    petitioner_ein_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    beneficiary_name: Optional[str] = None
    beneficiary_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    beneficiary_alien_number: Optional[str] = None
    beneficiary_alien_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    nonimmigrant_classification: Optional[str] = None
    nonimmigrant_classification_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    period_of_stay_requested: Optional[str] = None
    period_of_stay_requested_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    job_title: Optional[str] = None
    job_title_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    wage_rate_of_pay: Optional[str] = None
    wage_rate_of_pay_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I140LLM(BaseModel):
    petitioner_name: Optional[str] = None
    petitioner_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    petitioner_ein: Optional[str] = None
    petitioner_ein_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    beneficiary_name: Optional[str] = None
    beneficiary_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    beneficiary_alien_number: Optional[str] = None
    beneficiary_alien_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    preference_classification: Optional[str] = None
    preference_classification_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    priority_date: Optional[str] = None
    priority_date_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    job_title: Optional[str] = None
    job_title_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    offered_wage: Optional[str] = None
    offered_wage_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I797LLM(BaseModel):
    receipt_number: Optional[str] = None
    receipt_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    notice_type: Optional[str] = None
    notice_type_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    applicant_name: Optional[str] = None
    applicant_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    alien_registration_number: Optional[str] = None
    alien_registration_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    case_type: Optional[str] = None
    case_type_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    notice_date: Optional[str] = None
    notice_date_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    validity_start: Optional[str] = None
    validity_start_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    validity_end: Optional[str] = None
    validity_end_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    action_taken: Optional[str] = None
    action_taken_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I751LLM(BaseModel):
    alien_registration_number: Optional[str] = None
    alien_registration_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    family_name: Optional[str] = None
    family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    given_name: Optional[str] = None
    given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_of_birth: Optional[str] = None
    date_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    country_of_birth: Optional[str] = None
    country_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    joint_petitioner_name: Optional[str] = None
    joint_petitioner_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_card_expires: Optional[str] = None
    date_card_expires_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    basis_for_petition: Optional[str] = None
    basis_for_petition_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I130LLM(BaseModel):
    petitioner_family_name: Optional[str] = None
    petitioner_family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    petitioner_given_name: Optional[str] = None
    petitioner_given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    petitioner_dob: Optional[str] = None
    petitioner_dob_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    petitioner_alien_number: Optional[str] = None
    petitioner_alien_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    relationship_to_beneficiary: Optional[str] = None
    relationship_to_beneficiary_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    beneficiary_family_name: Optional[str] = None
    beneficiary_family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    beneficiary_given_name: Optional[str] = None
    beneficiary_given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    beneficiary_dob: Optional[str] = None
    beneficiary_dob_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    beneficiary_country_of_birth: Optional[str] = None
    beneficiary_country_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I131LLM(BaseModel):
    family_name: Optional[str] = None
    family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    given_name: Optional[str] = None
    given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    alien_registration_number: Optional[str] = None
    alien_registration_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_of_birth: Optional[str] = None
    date_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    class_of_admission: Optional[str] = None
    class_of_admission_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_of_admission: Optional[str] = None
    date_of_admission_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    country_of_birth: Optional[str] = None
    country_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    travel_document_type: Optional[str] = None
    travel_document_type_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reason_for_travel: Optional[str] = None
    reason_for_travel_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I539LLM(BaseModel):
    family_name: Optional[str] = None
    family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    given_name: Optional[str] = None
    given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    alien_registration_number: Optional[str] = None
    alien_registration_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_of_birth: Optional[str] = None
    date_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    country_of_birth: Optional[str] = None
    country_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    current_nonimmigrant_status: Optional[str] = None
    current_nonimmigrant_status_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    status_expires: Optional[str] = None
    status_expires_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    requested_status: Optional[str] = None
    requested_status_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I765LLM(BaseModel):
    family_name: Optional[str] = None
    family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    given_name: Optional[str] = None
    given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    alien_registration_number: Optional[str] = None
    alien_registration_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_of_birth: Optional[str] = None
    date_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    country_of_birth: Optional[str] = None
    country_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    ssn: Optional[str] = None
    ssn_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    eligibility_category: Optional[str] = None
    eligibility_category_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_eligibility_expires: Optional[str] = None
    date_eligibility_expires_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I290BLLM(BaseModel):
    receipt_number: Optional[str] = None
    receipt_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    form_type_appealed: Optional[str] = None
    form_type_appealed_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    applicant_name: Optional[str] = None
    applicant_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    alien_registration_number: Optional[str] = None
    alien_registration_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_of_decision: Optional[str] = None
    date_of_decision_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reason_for_appeal: Optional[str] = None
    reason_for_appeal_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    brief_attached: Optional[str] = None
    brief_attached_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I129FLLM(BaseModel):
    petitioner_family_name: Optional[str] = None
    petitioner_family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    petitioner_given_name: Optional[str] = None
    petitioner_given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    petitioner_dob: Optional[str] = None
    petitioner_dob_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    beneficiary_family_name: Optional[str] = None
    beneficiary_family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    beneficiary_given_name: Optional[str] = None
    beneficiary_given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    beneficiary_dob: Optional[str] = None
    beneficiary_dob_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    beneficiary_country_of_birth: Optional[str] = None
    beneficiary_country_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_met_beneficiary: Optional[str] = None
    date_met_beneficiary_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    prior_petitions: Optional[str] = None
    prior_petitions_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class N600LLM(BaseModel):
    family_name: Optional[str] = None
    family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    given_name: Optional[str] = None
    given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_of_birth: Optional[str] = None
    date_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    country_of_birth: Optional[str] = None
    country_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    alien_registration_number: Optional[str] = None
    alien_registration_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    us_citizen_parent_name: Optional[str] = None
    us_citizen_parent_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    parent_citizenship_date: Optional[str] = None
    parent_citizenship_date_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    basis_for_citizenship: Optional[str] = None
    basis_for_citizenship_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I485SuppJLLM(BaseModel):
    alien_registration_number: Optional[str] = None
    alien_registration_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    family_name: Optional[str] = None
    family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    given_name: Optional[str] = None
    given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    principal_applicant_name: Optional[str] = None
    principal_applicant_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    job_offer_employer: Optional[str] = None
    job_offer_employer_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    job_offer_title: Optional[str] = None
    job_offer_title_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    job_offer_soc_code: Optional[str] = None
    job_offer_soc_code_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    portability_claim: Optional[str] = None
    portability_claim_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I824LLM(BaseModel):
    alien_registration_number: Optional[str] = None
    alien_registration_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    family_name: Optional[str] = None
    family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    given_name: Optional[str] = None
    given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    original_form_type: Optional[str] = None
    original_form_type_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    original_receipt_number: Optional[str] = None
    original_receipt_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    original_approval_date: Optional[str] = None
    original_approval_date_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    action_requested: Optional[str] = None
    action_requested_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


class I90LLM(BaseModel):
    alien_registration_number: Optional[str] = None
    alien_registration_number_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    family_name: Optional[str] = None
    family_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    given_name: Optional[str] = None
    given_name_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    date_of_birth: Optional[str] = None
    date_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    country_of_birth: Optional[str] = None
    country_of_birth_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    card_expiration_date: Optional[str] = None
    card_expiration_date_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reason_for_replacement: Optional[str] = None
    reason_for_replacement_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    narrative_flags: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Registries
# ---------------------------------------------------------------------------

FORM_SCHEMAS: dict[str, type[BaseModel]] = {
    "I-485":        I485,
    "N-400":        N400,
    "I-129":        I129,
    "I-140":        I140,
    "I-797":        I797,
    "I-751":        I751,
    "I-130":        I130,
    "I-131":        I131,
    "I-539":        I539,
    "I-765":        I765,
    "I-290B":       I290B,
    "I-129F":       I129F,
    "N-600":        N600,
    "I-485_SUPP_J": I485SuppJ,
    "I-824":        I824,
    "I-90":         I90,
}

LLM_SCHEMAS: dict[str, type[BaseModel]] = {
    "I-485":        I485LLM,
    "N-400":        N400LLM,
    "I-129":        I129LLM,
    "I-140":        I140LLM,
    "I-797":        I797LLM,
    "I-751":        I751LLM,
    "I-130":        I130LLM,
    "I-131":        I131LLM,
    "I-539":        I539LLM,
    "I-765":        I765LLM,
    "I-290B":       I290BLLM,
    "I-129F":       I129FLLM,
    "N-600":        N600LLM,
    "I-485_SUPP_J": I485SuppJLLM,
    "I-824":        I824LLM,
    "I-90":         I90LLM,
}


# ---------------------------------------------------------------------------
# Form metadata
# ---------------------------------------------------------------------------

class FormMeta:
    __slots__ = ("full_name", "has_acroform", "supplement_of", "group")

    def __init__(
        self,
        full_name: str,
        has_acroform: bool,
        supplement_of: Optional[str],
        group: str,
    ) -> None:
        self.full_name = full_name
        self.has_acroform = has_acroform
        self.supplement_of = supplement_of
        self.group = group

    def as_dict(self) -> dict:
        return {
            "full_name": self.full_name,
            "has_acroform": self.has_acroform,
            "supplement_of": self.supplement_of,
            "group": self.group,
        }


FORM_METADATA: dict[str, FormMeta] = {
    "I-485": FormMeta(
        full_name="Application to Register Permanent Residence or Adjust Status",
        has_acroform=True,
        supplement_of=None,
        group="adjustment",
    ),
    "N-400": FormMeta(
        full_name="Application for Naturalization",
        has_acroform=True,
        supplement_of=None,
        group="naturalization",
    ),
    "I-129": FormMeta(
        full_name="Petition for a Nonimmigrant Worker",
        has_acroform=True,
        supplement_of=None,
        group="petition",
    ),
    "I-140": FormMeta(
        full_name="Immigrant Petition for Alien Workers",
        has_acroform=True,
        supplement_of=None,
        group="petition",
    ),
    "I-797": FormMeta(
        full_name="Notice of Action",
        has_acroform=False,
        supplement_of=None,
        group="benefits",
    ),
    "I-751": FormMeta(
        full_name="Petition to Remove Conditions on Residence",
        has_acroform=True,
        supplement_of=None,
        group="adjustment",
    ),
    "I-130": FormMeta(
        full_name="Petition for Alien Relative",
        has_acroform=True,
        supplement_of=None,
        group="petition",
    ),
    "I-131": FormMeta(
        full_name="Application for Travel Document",
        has_acroform=True,
        supplement_of=None,
        group="benefits",
    ),
    "I-539": FormMeta(
        full_name="Application to Extend/Change Nonimmigrant Status",
        has_acroform=True,
        supplement_of=None,
        group="benefits",
    ),
    "I-765": FormMeta(
        full_name="Application for Employment Authorization",
        has_acroform=True,
        supplement_of=None,
        group="benefits",
    ),
    "I-290B": FormMeta(
        full_name="Notice of Appeal or Motion",
        has_acroform=False,
        supplement_of=None,
        group="appeal",
    ),
    "I-129F": FormMeta(
        full_name="Petition for Alien Fiance(e)",
        has_acroform=True,
        supplement_of=None,
        group="petition",
    ),
    "N-600": FormMeta(
        full_name="Application for Certificate of Citizenship",
        has_acroform=True,
        supplement_of=None,
        group="naturalization",
    ),
    "I-485_SUPP_J": FormMeta(
        full_name="Supplement J — Confirmation of Bona Fide Job Offer or Request for Job Portability",
        has_acroform=True,
        supplement_of="I-485",
        group="adjustment",
    ),
    "I-824": FormMeta(
        full_name="Application for Action on an Approved Application or Petition",
        has_acroform=True,
        supplement_of=None,
        group="benefits",
    ),
    "I-90": FormMeta(
        full_name="Application to Replace Permanent Resident Card",
        has_acroform=True,
        supplement_of=None,
        group="benefits",
    ),
}
