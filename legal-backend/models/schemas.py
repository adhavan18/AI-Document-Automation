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
    pass

class N400(ReceiptFieldsMixin):
    pass

class I129(ReceiptFieldsMixin):
    pass

class I140(ReceiptFieldsMixin):
    pass

class I797(ReceiptFieldsMixin):
    pass

class I751(ReceiptFieldsMixin):
    pass

class I130(ReceiptFieldsMixin):
    pass

class I131(ReceiptFieldsMixin):
    pass

class I539(ReceiptFieldsMixin):
    pass

class I765(ReceiptFieldsMixin):
    pass

class I290B(ReceiptFieldsMixin):
    pass

class I129F(ReceiptFieldsMixin):
    pass

class N600(ReceiptFieldsMixin):
    pass

class I485SuppJ(ReceiptFieldsMixin):
    pass

class I824(ReceiptFieldsMixin):
    pass

class I90(ReceiptFieldsMixin):
    pass


# ---------------------------------------------------------------------------
# Flat LLM extraction schemas
# Each field is a plain str (nullable) with a paired _confidence float.
# narrative_flags collects free-text anomaly/flag notes from the LLM.
# ---------------------------------------------------------------------------

class _BaseLLM(BaseModel):
    narrative_flags: List[str] = Field(default_factory=list)

class I485LLM(_BaseLLM): pass
class N400LLM(_BaseLLM): pass
class I129LLM(_BaseLLM): pass
class I140LLM(_BaseLLM): pass
class I797LLM(_BaseLLM): pass
class I751LLM(_BaseLLM): pass
class I130LLM(_BaseLLM): pass
class I131LLM(_BaseLLM): pass
class I539LLM(_BaseLLM): pass
class I765LLM(_BaseLLM): pass
class I290BLLM(_BaseLLM): pass
class I129FLLM(_BaseLLM): pass
class N600LLM(_BaseLLM): pass
class I485SuppJLLM(_BaseLLM): pass
class I824LLM(_BaseLLM): pass
class I90LLM(_BaseLLM): pass


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
