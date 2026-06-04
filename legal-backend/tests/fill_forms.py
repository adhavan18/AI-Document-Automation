"""
USCIS form test fixture generator — all 16 forms.

Steps:
  1. Download 14 blank fillable PDFs from USCIS (I-797 and I-290B are generated)
  2. Inspect AcroForm fields -> save field maps to tests/sample_forms/field_maps/
  3. Fill each form with Carlos Eduardo Ramirez test data
  4. Save filled PDFs to tests/sample_forms/filled/
  5. Generate I-797 approval notice with reportlab
  6. Generate I-290B appeal document with reportlab
  7. Print summary table
"""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys
import urllib.request

import pypdf
from pypdf.generic import NameObject

# ---------------------------------------------------------------------------
# Directories
# ---------------------------------------------------------------------------

ROOT       = pathlib.Path(__file__).parent
BLANK_DIR  = ROOT / "sample_forms" / "blank"
FILLED_DIR = ROOT / "sample_forms" / "filled"
MAPS_DIR   = ROOT / "sample_forms" / "field_maps"

for _d in (BLANK_DIR, FILLED_DIR, MAPS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Step 1 — Download blank forms
# I-797 and I-290B are generated with reportlab — no fillable templates
# ---------------------------------------------------------------------------

FORM_URLS: dict[str, str] = {
    "i485":  "https://www.uscis.gov/sites/default/files/document/forms/i-485.pdf",
    "n400":  "https://www.uscis.gov/sites/default/files/document/forms/n-400.pdf",
    "i129":  "https://www.uscis.gov/sites/default/files/document/forms/i-129.pdf",
    "i140":  "https://www.uscis.gov/sites/default/files/document/forms/i-140.pdf",
    "i751":  "https://www.uscis.gov/sites/default/files/document/forms/i-751.pdf",
    "i130":  "https://www.uscis.gov/sites/default/files/document/forms/i-130.pdf",
    "i131":  "https://www.uscis.gov/sites/default/files/document/forms/i-131.pdf",
    "i539":  "https://www.uscis.gov/sites/default/files/document/forms/i-539.pdf",
    "i765":  "https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf",
    "i129f": "https://www.uscis.gov/sites/default/files/document/forms/i-129f.pdf",
    "n600":  "https://www.uscis.gov/sites/default/files/document/forms/n-600.pdf",
    "i485j": "https://www.uscis.gov/sites/default/files/document/forms/i-485supj.pdf",
    "i824":  "https://www.uscis.gov/sites/default/files/document/forms/i-824.pdf",
    "i90":   "https://www.uscis.gov/sites/default/files/document/forms/i-90.pdf",
}

_HEADERS = {"User-Agent": "Mozilla/5.0"}


def download_blanks() -> dict[str, pathlib.Path]:
    print("\n[Step 1] Downloading blank USCIS forms")
    paths: dict[str, pathlib.Path] = {}
    for name, url in FORM_URLS.items():
        dest = BLANK_DIR / f"{name}_blank.pdf"
        if dest.exists():
            print(f"  {name:<7}: already present ({dest.stat().st_size:,} bytes)")
        else:
            print(f"  {name:<7}: downloading...", end=" ", flush=True)
            try:
                req = urllib.request.Request(url, headers=_HEADERS)
                with urllib.request.urlopen(req, timeout=60) as resp:
                    dest.write_bytes(resp.read())
                print(f"done ({dest.stat().st_size:,} bytes)")
            except Exception as exc:
                print(f"FAILED: {exc}")
                continue
        paths[name] = dest
    return paths


# ---------------------------------------------------------------------------
# Step 2 — Inspect AcroForm fields
# ---------------------------------------------------------------------------

def inspect_fields(blank_paths: dict[str, pathlib.Path]) -> dict[str, dict]:
    print("\n[Step 2] Inspecting AcroForm fields")
    all_maps: dict[str, dict] = {}
    for name, pdf_path in blank_paths.items():
        try:
            reader = pypdf.PdfReader(str(pdf_path))
            raw = reader.get_fields() or {}
            field_map: dict[str, dict] = {}
            for field_name, field_obj in raw.items():
                val = field_obj.get("/V")
                ft  = field_obj.get("/FT")
                if isinstance(val, pypdf.generic.NameObject):
                    val = str(val).lstrip("/")
                field_map[field_name] = {
                    "value": str(val) if val else None,
                    "type":  str(ft) if ft else None,
                }
            out = MAPS_DIR / f"{name}_fields.json"
            out.write_text(json.dumps(field_map, indent=2))
            print(f"  {name:<7}: {len(field_map):>4} fields -> {out.name}")
            all_maps[name] = field_map
        except Exception as exc:
            print(f"  {name:<7}: ERROR inspecting fields: {exc}")
    return all_maps


# ---------------------------------------------------------------------------
# Fill helper
# ---------------------------------------------------------------------------

def _fill(writer: pypdf.PdfWriter, data: dict[str, str]) -> int:
    """
    Write field values by matching widget /T (leaf name) against data keys.

    USCIS forms are XFA/AcroForm hybrids. Widget annotations store only the
    leaf name in /T (e.g. "Pt1Line1_FamilyName[0]"), not the full dotted
    path that pypdf.get_fields() returns.

    Returns count of annotations actually written.
    """
    filled = 0
    for page in writer.pages:
        annotations = page.get("/Annots")
        if not annotations:
            continue
        for annot_ref in annotations:
            annot = annot_ref.get_object() if hasattr(annot_ref, "get_object") else annot_ref
            if annot.get("/Subtype") != "/Widget":
                continue
            t = annot.get("/T")
            if t is None:
                continue
            leaf = str(t)
            if leaf in data:
                annot.update({
                    NameObject("/V"):  pypdf.generic.create_string_object(data[leaf]),
                    NameObject("/AS"): pypdf.generic.create_string_object(data[leaf]),
                })
                filled += 1
    return filled


def fill_form(
    blank_path: pathlib.Path,
    field_data: dict[str, str],
    out_name: str,
) -> tuple[pathlib.Path, int, int]:
    """Return (output_path, keys_matched_in_form, annotations_written)."""
    reader = pypdf.PdfReader(str(blank_path))
    writer = pypdf.PdfWriter()
    writer.append(reader)

    # Collect all leaf names present in annotations
    leaf_names: set[str] = set()
    for page in reader.pages:
        annots = page.get("/Annots")
        if not annots:
            continue
        for ref in annots:
            obj = ref.get_object() if hasattr(ref, "get_object") else ref
            t = obj.get("/T")
            if t:
                leaf_names.add(str(t))

    keys_matched = sum(1 for k in field_data if k in leaf_names)
    annotations_written = _fill(writer, field_data)

    out_path = FILLED_DIR / out_name
    with open(out_path, "wb") as f:
        writer.write(f)
    return out_path, keys_matched, annotations_written


# ---------------------------------------------------------------------------
# Applicant / employer data
# ---------------------------------------------------------------------------

APPLICANT = {
    "family_name":   "Ramirez",
    "given_name":    "Carlos",
    "middle_name":   "Eduardo",
    "full_name":     "Carlos Eduardo Ramirez",
    "alien_number":  "A087654321",
    "alien_no_dash": "087654321",
    "dob":           "03/15/1985",
    "country":       "Mexico",
    "ssn":           "555-12-3456",
    "street":        "456 Maple Street",
    "city":          "Austin",
    "state":         "TX",
    "zip":           "78701",
    "phone":         "512-555-0199",
    "email":         "c.ramirez@example.com",
    "entry_date":    "06/20/2018",
    "entry_status":  "F-1",
    "pr_date":       "01/10/2020",
    "fiance_name":   "Sofia Isabelle Morales",
    "fiance_dob":    "07/22/1988",
    "fiance_country":"Colombia",
    "met_date":      "04/10/2022",
    "parent_name":   "Luis Alberto Ramirez",
    "parent_cit_date":"09/15/2005",
}

EMPLOYER = {
    "name": "TechCorp Solutions Inc",
    "ein":  "47-1234567",
    "street": "100 Innovation Blvd",
    "city":   "Austin",
    "state":  "TX",
    "zip":    "78702",
}

# ---------------------------------------------------------------------------
# Per-form field maps (leaf /T annotation names)
# ---------------------------------------------------------------------------

I485_FIELDS = {
    "Pt1Line1_FamilyName[0]":                       APPLICANT["family_name"],
    "Pt1Line1_GivenName[0]":                        APPLICANT["given_name"],
    "Pt1Line1_MiddleName[0]":                       APPLICANT["middle_name"],
    "Pt1Line3_DOB[0]":                              APPLICANT["dob"],
    "AlienNumber[0]":                               APPLICANT["alien_number"],
    "Pt1Line4_AlienNumber[0]":                      APPLICANT["alien_number"],
    "Pt1Line7_CountryOfBirth[0]":                   APPLICANT["country"],
    "Pt1Line8_CountryofCitizenshipNationality[0]":  APPLICANT["country"],
    "Pt1Line12_Date[0]":                            APPLICANT["entry_date"],
    "Pt1Line12_Status[0]":                          APPLICANT["entry_status"],
    "Pt1Line10_CityTown[0]":                        "Houston",
    "Pt1Line10_State[0]":                           APPLICANT["state"],
    "Pt1Line19_SSN[0]":                             APPLICANT["ssn"],
}

N400_FIELDS = {
    "P2_Line1_FamilyName[0]":                       APPLICANT["family_name"],
    "P2_Line1_GivenName[0]":                        APPLICANT["given_name"],
    "P2_Line1_MiddleName[0]":                       APPLICANT["middle_name"],
    "Line1_AlienNumber[0]":                         APPLICANT["alien_number"],
    "P2_Line8_DateOfBirth[0]":                      APPLICANT["dob"],
    "P2_Line9_DateBecamePermanentResident[0]":      APPLICANT["pr_date"],
    "P2_Line10_CountryOfBirth[0]":                  APPLICANT["country"],
    "Line12b_SSN[0]":                               APPLICANT["ssn"],
    "P10_Line4a_FamilyName[0]":                     APPLICANT["family_name"],
    "P10_Line4a_GivenName[0]":                      "Maria Elena",
}

I129_FIELDS = {
    "Line1_FamilyName[0]":          APPLICANT["family_name"],
    "Line1_GivenName[0]":           APPLICANT["given_name"],
    "Line3_CompanyorOrgName[0]":    EMPLOYER["name"],
    "Part2_ClassificationSymbol[0]":"H-1B",
    "Part3_Line2_FamilyName[0]":    APPLICANT["family_name"],
    "Part3_Line2_GivenName[0]":     APPLICANT["given_name"],
    "Part3_Line2_MiddleName[0]":    APPLICANT["middle_name"],
    "Line25_EIN[0]":                EMPLOYER["ein"],
    "Line8_Wages[0]":               "145000",
    "Part5_Q1_JobTitle[0]":         "Software Engineer",
    "Sect1_PetitionerPrintedName[0]": EMPLOYER["name"],
    "Line1_PetitionerName[0]":      EMPLOYER["name"],
    "Line2_BeneficiaryName[0]":     APPLICANT["full_name"],
}

I140_FIELDS = {
    "Pt1Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt1Line1b_GivenName[0]":       APPLICANT["given_name"],
    "Line2_CompanyName[0]":         EMPLOYER["name"],
    "Pt1Line3_TaxNumber[0]":        EMPLOYER["ein"],
    "Pt3Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt3Line1b_GivenName[0]":       APPLICANT["given_name"],
    "Pt3Line1c_MiddleName[0]":      APPLICANT["middle_name"],
    "Line5_DateOfBirth[0]":         APPLICANT["dob"],
    "Line8_Country[0]":             APPLICANT["country"],
    "Pt3Line8_AlienNumber[0]":      APPLICANT["alien_number"],
    "Line1_JobTitle[0]":            "Senior Software Engineer",
    "Line8_Wages[0]":               "160000",
    "Line2i_LaborCertificationDate[0]": "03/01/2022",
}

I751_FIELDS = {
    "Pt1Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt1Line1b_GivenName[0]":       APPLICANT["given_name"],
    "Pt1Line1c_MiddleName[0]":      APPLICANT["middle_name"],
    "Pt1Line2_AlienNumber[0]":      APPLICANT["alien_number"],
    "Pt1Line4_DateOfBirth[0]":      APPLICANT["dob"],
    "Pt1Line5_CountryOfBirth[0]":   APPLICANT["country"],
    # Conditional residence obtained through marriage
    "Pt1Line11_DateStatusGranted[0]": APPLICANT["pr_date"],
    # Joint petitioner (spouse)
    "Pt2Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt2Line1b_GivenName[0]":       "Maria Elena",
    "Pt2Line1c_MiddleName[0]":      "Rosa",
    "Pt2Line2_AlienNumber[0]":      "A087654322",
    # Address
    "Pt1Line16a_StreetNumberName[0]": APPLICANT["street"],
    "Pt1Line16b_City[0]":           APPLICANT["city"],
    "Pt1Line16c_State[0]":          APPLICANT["state"],
    "Pt1Line16d_ZipCode[0]":        APPLICANT["zip"],
}

I130_FIELDS = {
    # Petitioner (US citizen / LPR)
    "Pt1Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt1Line1b_GivenName[0]":       "Maria Elena",
    "Pt1Line1c_MiddleName[0]":      "Rosa",
    "Pt1Line2_AlienNumber[0]":      "A087654322",
    "Pt1Line9_DateOfBirth[0]":      "05/20/1983",
    "Pt1Line10_CountryOfBirth[0]":  "United States",
    # Beneficiary
    "Pt3Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt3Line1b_GivenName[0]":       APPLICANT["given_name"],
    "Pt3Line1c_MiddleName[0]":      APPLICANT["middle_name"],
    "Pt3Line3_DateOfBirth[0]":      APPLICANT["dob"],
    "Pt3Line4_CountryOfBirth[0]":   APPLICANT["country"],
    "Pt3Line5_AlienNumber[0]":      APPLICANT["alien_number"],
    # Relationship
    "Pt2Line1_Relationship[0]":     "Spouse",
}

I131_FIELDS = {
    "Pt1Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt1Line1b_GivenName[0]":       APPLICANT["given_name"],
    "Pt1Line1c_MiddleName[0]":      APPLICANT["middle_name"],
    "Pt1Line2_AlienNumber[0]":      APPLICANT["alien_number"],
    "Pt1Line3_DateOfBirth[0]":      APPLICANT["dob"],
    "Pt1Line4_CountryOfBirth[0]":   APPLICANT["country"],
    "Pt1Line5_CountryOfCitizenship[0]": APPLICANT["country"],
    "Pt1Line6_SSN[0]":              APPLICANT["ssn"],
    # Travel document type — Advance Parole
    "Pt2Line1_DocType[0]":          "Advance Parole Document",
    # Intended travel
    "Pt3Line1_Countries[0]":        "Mexico, Colombia",
    "Pt3Line2_DepartureDate[0]":    "08/01/2024",
    "Pt3Line3_ReturnDate[0]":       "08/21/2024",
    # Address
    "Pt1Line13a_StreetNumberName[0]": APPLICANT["street"],
    "Pt1Line13b_City[0]":           APPLICANT["city"],
    "Pt1Line13c_State[0]":          APPLICANT["state"],
    "Pt1Line13d_ZipCode[0]":        APPLICANT["zip"],
}

I539_FIELDS = {
    "Pt1Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt1Line1b_GivenName[0]":       APPLICANT["given_name"],
    "Pt1Line1c_MiddleName[0]":      APPLICANT["middle_name"],
    "Pt1Line2_AlienNumber[0]":      APPLICANT["alien_number"],
    "Pt1Line3_DateOfBirth[0]":      APPLICANT["dob"],
    "Pt1Line4_CountryOfBirth[0]":   APPLICANT["country"],
    "Pt1Line5_CountryOfCitizenship[0]": APPLICANT["country"],
    # Current status
    "Pt2Line1_CurrentNonimmigrantStatus[0]": "F-1",
    "Pt2Line2_StatusExpiryDate[0]": "05/31/2025",
    # Extension requested
    "Pt2Line5_RequestedStatus[0]":  "H-4",
    # Address
    "Pt1Line9a_StreetNumberName[0]": APPLICANT["street"],
    "Pt1Line9b_City[0]":            APPLICANT["city"],
    "Pt1Line9c_State[0]":           APPLICANT["state"],
    "Pt1Line9d_ZipCode[0]":         APPLICANT["zip"],
}

I765_FIELDS = {
    "Pt1Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt1Line1b_GivenName[0]":       APPLICANT["given_name"],
    "Pt1Line1c_MiddleName[0]":      APPLICANT["middle_name"],
    "Pt1Line2_AlienNumber[0]":      APPLICANT["alien_number"],
    "Pt1Line3_DateOfBirth[0]":      APPLICANT["dob"],
    "Pt1Line4_CountryOfBirth[0]":   APPLICANT["country"],
    "Pt1Line5_CountryOfCitizenship[0]": APPLICANT["country"],
    "Pt1Line6_SSN[0]":              APPLICANT["ssn"],
    # Eligibility
    "Pt2Line1_EligibilityCategory[0]": "(c)(9)",
    # Address
    "Pt1Line15a_StreetNumberName[0]": APPLICANT["street"],
    "Pt1Line15b_City[0]":           APPLICANT["city"],
    "Pt1Line15c_State[0]":          APPLICANT["state"],
    "Pt1Line15d_ZipCode[0]":        APPLICANT["zip"],
}

I129F_FIELDS = {
    # Petitioner (US citizen)
    "Pt1Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt1Line1b_GivenName[0]":       APPLICANT["given_name"],
    "Pt1Line1c_MiddleName[0]":      APPLICANT["middle_name"],
    "Pt1Line3_DateOfBirth[0]":      APPLICANT["dob"],
    "Pt1Line4_CountryOfBirth[0]":   "United States",
    # Beneficiary (fiance)
    "Pt3Line1a_FamilyName[0]":      "Morales",
    "Pt3Line1b_GivenName[0]":       "Sofia",
    "Pt3Line1c_MiddleName[0]":      "Isabelle",
    "Pt3Line2_DateOfBirth[0]":      APPLICANT["fiance_dob"],
    "Pt3Line3_CountryOfBirth[0]":   APPLICANT["fiance_country"],
    # Met in person
    "Pt4Line1_DateMet[0]":          APPLICANT["met_date"],
    "Pt4Line2_PlaceMet[0]":         "Bogota, Colombia",
    # Prior petitions
    "Pt4Line7_PriorPetitions[0]":   "No",
    # Address
    "Pt1Line9a_StreetNumberName[0]": APPLICANT["street"],
    "Pt1Line9b_City[0]":            APPLICANT["city"],
    "Pt1Line9c_State[0]":           APPLICANT["state"],
    "Pt1Line9d_ZipCode[0]":         APPLICANT["zip"],
}

N600_FIELDS = {
    "Pt1Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt1Line1b_GivenName[0]":       APPLICANT["given_name"],
    "Pt1Line1c_MiddleName[0]":      APPLICANT["middle_name"],
    "Pt1Line2_AlienNumber[0]":      APPLICANT["alien_number"],
    "Pt1Line3_DateOfBirth[0]":      APPLICANT["dob"],
    "Pt1Line4_CountryOfBirth[0]":   APPLICANT["country"],
    # Citizenship basis — derived through parent
    "Pt2Line1_BasisForCitizenship[0]": "Through US citizen parent",
    # Qualifying parent
    "Pt3Line1a_FamilyName[0]":      APPLICANT["parent_name"].split()[-1],
    "Pt3Line1b_GivenName[0]":       APPLICANT["parent_name"].split()[0],
    "Pt3Line2_DateOfBirth[0]":      "04/10/1958",
    "Pt3Line3_CountryOfBirth[0]":   APPLICANT["country"],
    "Pt3Line8_CitizenshipDate[0]":  APPLICANT["parent_cit_date"],
    # Address
    "Pt1Line11a_StreetNumberName[0]": APPLICANT["street"],
    "Pt1Line11b_City[0]":           APPLICANT["city"],
    "Pt1Line11c_State[0]":          APPLICANT["state"],
    "Pt1Line11d_ZipCode[0]":        APPLICANT["zip"],
}

I485J_FIELDS = {
    # Supplement J — portability / job offer
    "Pt1Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt1Line1b_GivenName[0]":       APPLICANT["given_name"],
    "Pt1Line1c_MiddleName[0]":      APPLICANT["middle_name"],
    "Pt1Line2_AlienNumber[0]":      APPLICANT["alien_number"],
    # New employer
    "Pt2Line1_EmployerName[0]":     EMPLOYER["name"],
    "Pt2Line2_EIN[0]":              EMPLOYER["ein"],
    "Pt2Line3a_StreetNumberName[0]": EMPLOYER["street"],
    "Pt2Line3b_City[0]":            EMPLOYER["city"],
    "Pt2Line3c_State[0]":           EMPLOYER["state"],
    "Pt2Line3d_ZipCode[0]":         EMPLOYER["zip"],
    # Job offer
    "Pt2Line4_JobTitle[0]":         "Senior Software Engineer",
    "Pt2Line5_SOCCode[0]":          "15-1252.00",
    "Pt2Line6_JobDescription[0]":   "Design and develop enterprise software systems",
    "Pt2Line7_Wage[0]":             "160000",
    # I-485 receipt number
    "Pt1Line3_ReceiptNumber[0]":    "EAC2290123456",
}

I824_FIELDS = {
    "Pt1Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt1Line1b_GivenName[0]":       APPLICANT["given_name"],
    "Pt1Line1c_MiddleName[0]":      APPLICANT["middle_name"],
    "Pt1Line2_AlienNumber[0]":      APPLICANT["alien_number"],
    "Pt1Line3_DateOfBirth[0]":      APPLICANT["dob"],
    "Pt1Line4_CountryOfBirth[0]":   APPLICANT["country"],
    # Original approved petition
    "Pt2Line1_OriginalReceiptNumber[0]": "EAC2290123456",
    "Pt2Line2_FormType[0]":         "I-129",
    "Pt2Line3_ApprovalDate[0]":     "12/01/2023",
    # Action requested
    "Pt2Line4_ActionRequested[0]":  "Notify US consulate abroad",
    "Pt2Line5_ConsulateCity[0]":    "Mexico City",
    "Pt2Line5_ConsulateCountry[0]": "Mexico",
    # Address
    "Pt1Line9a_StreetNumberName[0]": APPLICANT["street"],
    "Pt1Line9b_City[0]":            APPLICANT["city"],
    "Pt1Line9c_State[0]":           APPLICANT["state"],
    "Pt1Line9d_ZipCode[0]":         APPLICANT["zip"],
}

I90_FIELDS = {
    "Pt1Line1a_FamilyName[0]":      APPLICANT["family_name"],
    "Pt1Line1b_GivenName[0]":       APPLICANT["given_name"],
    "Pt1Line1c_MiddleName[0]":      APPLICANT["middle_name"],
    "Pt1Line2_AlienNumber[0]":      APPLICANT["alien_number"],
    "Pt1Line3_DateOfBirth[0]":      APPLICANT["dob"],
    "Pt1Line4_CountryOfBirth[0]":   APPLICANT["country"],
    "Pt1Line5_CountryOfCitizenship[0]": APPLICANT["country"],
    "Pt1Line6_SSN[0]":              APPLICANT["ssn"],
    # Reason for renewal/replacement — code 1 (10-year card expired/expiring)
    "Pt2Line1_ReasonCode[0]":       "1",
    # Current card info
    "Pt1Line8_CardExpiryDate[0]":   "01/10/2030",
    # Address
    "Pt1Line11a_StreetNumberName[0]": APPLICANT["street"],
    "Pt1Line11b_City[0]":           APPLICANT["city"],
    "Pt1Line11c_State[0]":          APPLICANT["state"],
    "Pt1Line11d_ZipCode[0]":        APPLICANT["zip"],
}

# Map form key -> (field_data, output_filename)
FILLABLE_FORMS: dict[str, tuple[dict[str, str], str]] = {
    "i485":  (I485_FIELDS,  "i485_filled.pdf"),
    "n400":  (N400_FIELDS,  "n400_filled.pdf"),
    "i129":  (I129_FIELDS,  "i129_filled.pdf"),
    "i140":  (I140_FIELDS,  "i140_filled.pdf"),
    "i751":  (I751_FIELDS,  "i751_filled.pdf"),
    "i130":  (I130_FIELDS,  "i130_filled.pdf"),
    "i131":  (I131_FIELDS,  "i131_filled.pdf"),
    "i539":  (I539_FIELDS,  "i539_filled.pdf"),
    "i765":  (I765_FIELDS,  "i765_filled.pdf"),
    "i129f": (I129F_FIELDS, "i129f_filled.pdf"),
    "n600":  (N600_FIELDS,  "n600_filled.pdf"),
    "i485j": (I485J_FIELDS, "i485j_filled.pdf"),
    "i824":  (I824_FIELDS,  "i824_filled.pdf"),
    "i90":   (I90_FIELDS,   "i90_filled.pdf"),
}


# ---------------------------------------------------------------------------
# Steps 3 + 4 — Fill all downloaded forms
# ---------------------------------------------------------------------------

def fill_all_forms(blank_paths: dict[str, pathlib.Path]) -> list[dict]:
    print("\n[Steps 3+4] Filling forms with applicant data")
    results = []
    for form_key, (field_data, out_name) in FILLABLE_FORMS.items():
        if form_key not in blank_paths:
            print(f"  {form_key:<7}: SKIPPED (blank not downloaded)")
            results.append({
                "form": _display_name(form_key),
                "keys_targeted": len(field_data),
                "keys_matched": 0,
                "annotations_written": 0,
                "out_name": out_name,
                "path": "—",
                "size_kb": 0,
                "skipped": True,
            })
            continue
        try:
            out_path, matched, written = fill_form(
                blank_paths[form_key], field_data, out_name
            )
            size_kb = out_path.stat().st_size // 1024
            print(
                f"  {form_key:<7}: {matched}/{len(field_data)} keys matched, "
                f"{written} written, {size_kb} KB -> {out_name}"
            )
            results.append({
                "form": _display_name(form_key),
                "keys_targeted": len(field_data),
                "keys_matched": matched,
                "annotations_written": written,
                "out_name": out_name,
                "path": str(out_path),
                "size_kb": size_kb,
                "skipped": False,
            })
        except Exception as exc:
            print(f"  {form_key:<7}: ERROR: {exc}")
            results.append({
                "form": _display_name(form_key),
                "keys_targeted": len(field_data),
                "keys_matched": 0,
                "annotations_written": 0,
                "out_name": out_name,
                "path": f"ERROR: {exc}",
                "size_kb": 0,
                "skipped": False,
            })
    return results


def _display_name(key: str) -> str:
    return {
        "i485": "I-485", "n400": "N-400", "i129": "I-129", "i140": "I-140",
        "i751": "I-751", "i130": "I-130", "i131": "I-131", "i539": "I-539",
        "i765": "I-765", "i129f": "I-129F", "n600": "N-600", "i485j": "I-485J",
        "i824": "I-824", "i90": "I-90",
    }.get(key, key.upper())


# ---------------------------------------------------------------------------
# Step 5 — Generate I-797 approval notice with reportlab
# ---------------------------------------------------------------------------

def _ensure_reportlab() -> None:
    try:
        import reportlab  # noqa: F401
    except ImportError:
        print("  installing reportlab...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "reportlab", "-q"])


def generate_i797() -> pathlib.Path:
    print("\n[Step 5] Generating synthetic I-797 approval notice")
    _ensure_reportlab()

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    out_path = FILLED_DIR / "i797_notice.pdf"
    doc = SimpleDocTemplate(
        str(out_path), pagesize=letter,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        leftMargin=1.0 * inch, rightMargin=1.0 * inch,
    )
    styles = getSampleStyleSheet()

    def _style(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)

    hdr   = _style("Hdr",   fontSize=10, fontName="Helvetica-Bold", spaceAfter=2)
    lbl   = _style("Lbl",   fontSize=9,  fontName="Helvetica-Bold")
    body  = _style("Body",  fontSize=9,  fontName="Helvetica", spaceAfter=4, leading=14)
    title = _style("Title", fontSize=14, fontName="Helvetica-Bold", spaceAfter=6, alignment=1)
    act   = _style("Act",   fontSize=12, fontName="Helvetica-Bold",
                   textColor=colors.HexColor("#1a5c1a"), spaceAfter=6)

    story = []
    story += [
        Paragraph("U.S. Department of Homeland Security", hdr),
        Paragraph("U.S. Citizenship and Immigration Services", hdr),
        Spacer(1, 0.15 * inch),
        Paragraph("NOTICE OF ACTION", title),
        Spacer(1, 0.1 * inch),
    ]

    notice_data = [
        ["Receipt Number",  "EAC2290123456",              "Notice Date",  "11/15/2023"],
        ["Case Type",       "Form I-129 H-1B Petition",   "Notice Type",  "Approval Notice"],
        ["Petitioner",      EMPLOYER["name"],              "",             ""],
        ["Beneficiary",     "Ramirez, Carlos Eduardo",     "A-Number",     "A087654321"],
    ]
    tbl = Table(notice_data, colWidths=[1.3*inch, 2.5*inch, 1.1*inch, 1.6*inch])
    tbl.setStyle(TableStyle([
        ("FONTNAME",      (0,0), (-1,-1), "Helvetica"),
        ("FONTNAME",      (0,0), (0,-1),  "Helvetica-Bold"),
        ("FONTNAME",      (2,0), (2,-1),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 9),
        ("BACKGROUND",    (0,0), (-1,0),  colors.HexColor("#e8e8e8")),
        ("GRID",          (0,0), (-1,-1), 0.5, colors.grey),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
    ]))
    story += [tbl, Spacer(1, 0.2*inch), Paragraph("<b>ACTION TAKEN: APPROVED</b>", act)]

    vtbl = Table(
        [["Valid From", "12/01/2023", "Valid To", "11/30/2026"]],
        colWidths=[1.0*inch, 2.0*inch, 0.8*inch, 2.0*inch],
    )
    vtbl.setStyle(TableStyle([
        ("FONTNAME",      (0,0), (-1,-1), "Helvetica"),
        ("FONTNAME",      (0,0), (0,-1),  "Helvetica-Bold"),
        ("FONTNAME",      (2,0), (2,-1),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 10),
        ("BACKGROUND",    (0,0), (-1,-1), colors.HexColor("#f0f8f0")),
        ("BOX",           (0,0), (-1,-1), 1.0, colors.HexColor("#1a5c1a")),
        ("TOPPADDING",    (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
    ]))
    story += [vtbl, Spacer(1, 0.2*inch)]

    for para in [
        "The above petition/application has been approved as indicated. "
        "This notice does not grant any immigration status or benefit. "
        "This notice is not a visa and may not be used in place of a visa.",
        "The beneficiary must maintain the nonimmigrant status indicated above "
        "and comply with all conditions of the approved petition. "
        "This approval is valid only during the period specified above.",
    ]:
        story.append(Paragraph(para, body))

    story += [Spacer(1, 0.15*inch), Paragraph("CASE DETAILS", lbl)]
    for label, val in [
        ("Classification Approved:", "H-1B Specialty Occupation Worker"),
        ("Period of Stay:", "12/01/2023 through 11/30/2026"),
        ("Employer (Petitioner):", EMPLOYER["name"]),
        ("Position:", "Software Engineer"),
        ("Work Location:", f"{EMPLOYER['city']}, {EMPLOYER['state']} {EMPLOYER['zip']}"),
    ]:
        story.append(Paragraph(f"<b>{label}</b> {val}", body))

    story += [
        Spacer(1, 0.2*inch),
        Paragraph(
            "If you have questions about this notice, contact USCIS at "
            "1-800-375-5283 and reference receipt number EAC2290123456.",
            body,
        ),
    ]
    doc.build(story)
    size_kb = out_path.stat().st_size // 1024
    print(f"  I-797 -> {out_path.name} ({size_kb} KB)")
    return out_path


# ---------------------------------------------------------------------------
# Step 6 — Generate I-290B appeal document with reportlab
# ---------------------------------------------------------------------------

def generate_i290b() -> pathlib.Path:
    print("\n[Step 6] Generating synthetic I-290B appeal document")
    _ensure_reportlab()

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    out_path = FILLED_DIR / "i290b_appeal.pdf"
    doc = SimpleDocTemplate(
        str(out_path), pagesize=letter,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
        leftMargin=1.0 * inch, rightMargin=1.0 * inch,
    )
    styles = getSampleStyleSheet()

    def _style(name, **kw):
        return ParagraphStyle(name, parent=styles["Normal"], **kw)

    hdr   = _style("Hdr",   fontSize=10, fontName="Helvetica-Bold", spaceAfter=2)
    body  = _style("Body",  fontSize=9,  fontName="Helvetica", spaceAfter=6, leading=14)
    title = _style("Title", fontSize=14, fontName="Helvetica-Bold", spaceAfter=8, alignment=1)
    sec   = _style("Sec",   fontSize=10, fontName="Helvetica-Bold", spaceAfter=4, spaceBefore=10)
    mono  = _style("Mono",  fontSize=9,  fontName="Courier", spaceAfter=4, leading=13)

    story = []
    story += [
        Paragraph("U.S. Department of Homeland Security", hdr),
        Paragraph("U.S. Citizenship and Immigration Services", hdr),
        Spacer(1, 0.15 * inch),
        Paragraph("NOTICE OF APPEAL OR MOTION", title),
        Paragraph("Form I-290B", _style("Sub", fontSize=11, fontName="Helvetica", alignment=1)),
        Spacer(1, 0.2 * inch),
    ]

    # Case information table
    case_data = [
        ["Appellant / Attorney:", "Carlos Eduardo Ramirez",    "Receipt No.:", "WAC2390012345"],
        ["Form Appealed:",        "Form I-140",                "Decision Date:", "09/10/2023"],
        ["Office:",               "Nebraska Service Center",   "Filing Date:",   "10/08/2023"],
        ["Alien Number:",         "A087654321",                "Appeal Type:",   "Appeal to AAO"],
    ]
    ct = Table(case_data, colWidths=[1.5*inch, 2.3*inch, 1.1*inch, 1.6*inch])
    ct.setStyle(TableStyle([
        ("FONTNAME",      (0,0), (-1,-1), "Helvetica"),
        ("FONTNAME",      (0,0), (0,-1),  "Helvetica-Bold"),
        ("FONTNAME",      (2,0), (2,-1),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 9),
        ("BACKGROUND",    (0,0), (-1,0),  colors.HexColor("#e8e8e8")),
        ("GRID",          (0,0), (-1,-1), 0.5, colors.grey),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
    ]))
    story += [ct, Spacer(1, 0.2*inch)]

    story.append(Paragraph("BASIS FOR APPEAL", sec))
    story.append(Paragraph(
        "Appellant appeals the denial of the Form I-140, Immigrant Petition for Alien "
        "Workers, filed on behalf of Carlos Eduardo Ramirez (A087654321) under the "
        "employment-based second preference category (EB-2) as a member of a profession "
        "holding an advanced degree.",
        body,
    ))

    story.append(Paragraph("STATEMENT OF FACTS", sec))
    story.append(Paragraph(
        "The petitioner, TechCorp Solutions Inc, employs the beneficiary as a Senior "
        "Software Engineer (SOC 15-1252.00). The beneficiary holds a Master of Science "
        "in Computer Science from the University of Texas at Austin (May 2012) and has "
        "accumulated more than eleven years of progressive experience in enterprise "
        "software architecture. The denial erroneously concluded that the beneficiary's "
        "degree did not qualify as an advanced degree within the meaning of 8 C.F.R. "
        "204.5(k)(2).",
        body,
    ))

    story.append(Paragraph("LEGAL ARGUMENT", sec))
    story.append(Paragraph(
        "I. THE BENEFICIARY HOLDS A QUALIFYING ADVANCED DEGREE",
        _style("Arg", fontSize=9, fontName="Helvetica-Bold", spaceAfter=4),
    ))
    story.append(Paragraph(
        "Under 8 C.F.R. 204.5(k)(2), an 'advanced degree' includes any United States "
        "academic or professional degree or foreign equivalent degree above the "
        "baccalaureate level. The beneficiary's Master of Science in Computer Science "
        "is unambiguously above the baccalaureate level. See Matter of Shah, 17 I&N Dec. "
        "244 (Reg. Comm. 1977). The Service's denial did not address the beneficiary's "
        "graduate transcript or diploma submitted as Exhibit 3.",
        body,
    ))
    story.append(Paragraph(
        "II. THE PROFFERED POSITION REQUIRES AN ADVANCED DEGREE",
        _style("Arg2", fontSize=9, fontName="Helvetica-Bold", spaceAfter=4),
    ))
    story.append(Paragraph(
        "The petitioner's Labor Condition Application (LCA), DOL case number "
        "I-200-23012-123456, certified on January 15, 2023, confirms that the Senior "
        "Software Engineer position normally requires a minimum of a Master's degree in "
        "Computer Science, Software Engineering, or a related field. The petitioner "
        "submitted detailed job duties (Exhibit 4) demonstrating that the position "
        "requires theoretical and applied knowledge at the graduate level, consistent "
        "with Matter of Grimson, 16 I&N Dec. 236 (BIA 1977).",
        body,
    ))

    story.append(Paragraph("CONCLUSION", sec))
    story.append(Paragraph(
        "For the foregoing reasons, the appellant respectfully requests that the "
        "Administrative Appeals Office sustain this appeal, withdraw the denial, and "
        "approve the Form I-140 petition. In the alternative, appellant requests that "
        "the matter be remanded for further consideration consistent with the evidence "
        "of record.",
        body,
    ))

    story += [
        Spacer(1, 0.3 * inch),
        Paragraph("Respectfully submitted,", body),
        Spacer(1, 0.1 * inch),
        Paragraph("Carlos Eduardo Ramirez", _style("Sig", fontSize=10, fontName="Helvetica-Bold")),
        Paragraph("Appellant, Pro Se", body),
        Paragraph(f"456 Maple Street, Austin, TX 78701", body),
        Paragraph("Date: October 8, 2023", body),
    ]

    doc.build(story)
    size_kb = out_path.stat().st_size // 1024
    print(f"  I-290B -> {out_path.name} ({size_kb} KB)")
    return out_path


# ---------------------------------------------------------------------------
# Step 7 — Summary table
# ---------------------------------------------------------------------------

def print_summary(
    form_results: list[dict],
    i797_path: pathlib.Path,
    i290b_path: pathlib.Path,
) -> None:
    print("\n[Step 7] Summary")
    w = [8, 10, 10, 10, 8, 50]
    header = (
        f"{'Form':<{w[0]}} {'Targeted':<{w[1]}} {'Matched':<{w[2]}} "
        f"{'Written':<{w[3]}} {'KB':<{w[4]}} {'Output'}"
    )
    print()
    print(header)
    print("-" * sum(w))

    for r in form_results:
        skipped = r.get("skipped", False)
        matched = "SKIP" if skipped else str(r["keys_matched"])
        written = "SKIP" if skipped else str(r["annotations_written"])
        kb      = "—" if skipped or r["size_kb"] == 0 else str(r["size_kb"])
        out     = "—" if skipped else r["out_name"]
        print(
            f"{r['form']:<{w[0]}} {r['keys_targeted']:<{w[1]}} {matched:<{w[2]}} "
            f"{written:<{w[3]}} {kb:<{w[4]}} {out}"
        )

    for label, path in [("I-797", i797_path), ("I-290B", i290b_path)]:
        kb = path.stat().st_size // 1024 if path.exists() else 0
        print(
            f"{label:<{w[0]}} {'N/A':<{w[1]}} {'N/A':<{w[2]}} "
            f"{'N/A':<{w[3]}} {kb:<{w[4]}} {path.name}"
        )

    print()
    print(f"All files in: {FILLED_DIR}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    blank_paths  = download_blanks()
    _            = inspect_fields(blank_paths)
    form_results = fill_all_forms(blank_paths)
    i797_path    = generate_i797()
    i290b_path   = generate_i290b()
    print_summary(form_results, i797_path, i290b_path)
