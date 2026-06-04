import json, pathlib

BASE = pathlib.Path(r'c:\Users\moham\Downloads\old\legal-processing')
skills_dir = BASE / 'skills'
skills_dir.mkdir(exist_ok=True)

FORMS = {
  'i-485': {
    'form_id': 'I-485', 'form_title': 'Application to Register Permanent Residence or Adjust Status',
    'fields': [
      {'name':'alien_registration_number','required':True,'type':'string','hint':'Part 1, Item 1 — A-Number (A-XXXXXXXXX)'},
      {'name':'family_name','required':True,'type':'string','hint':'Part 1, Item 2.a'},
      {'name':'given_name','required':True,'type':'string','hint':'Part 1, Item 2.b'},
      {'name':'date_of_birth','required':True,'type':'date','hint':'Part 1, Item 3 — MM/DD/YYYY'},
      {'name':'country_of_birth','required':True,'type':'string','hint':'Part 1, Item 5'},
      {'name':'date_of_entry','required':False,'type':'date','hint':'Part 1, Item 12'},
      {'name':'class_of_admission','required':False,'type':'string','hint':'Part 1, Item 13 — visa class'},
      {'name':'ssn','required':False,'type':'string','hint':'Part 1, Item 7 — Social Security Number'},
    ]},
  'n-400': {
    'form_id': 'N-400', 'form_title': 'Application for Naturalization',
    'fields': [
      {'name':'family_name','required':True,'type':'string','hint':'Part 1, Item 1.a'},
      {'name':'given_name','required':True,'type':'string','hint':'Part 1, Item 1.b'},
      {'name':'date_of_birth','required':True,'type':'date','hint':'Part 2, Item 2'},
      {'name':'country_of_birth','required':True,'type':'string','hint':'Part 2, Item 6'},
      {'name':'alien_registration_number','required':True,'type':'string','hint':'Part 1, Item 5 — A-Number'},
      {'name':'date_became_pr','required':True,'type':'date','hint':'Part 2, Item 14 — date became LPR'},
      {'name':'marital_status','required':True,'type':'string','hint':'Part 7, Item 1 — Single/Married/Divorced/Widowed'},
    ]},
  'i-129': {
    'form_id': 'I-129', 'form_title': 'Petition for a Nonimmigrant Worker',
    'fields': [
      {'name':'petitioner_name','required':True,'type':'string','hint':'Part 1, Item 1 — Legal name of petitioner'},
      {'name':'petitioner_ein','required':True,'type':'string','hint':'Part 1, Item 6 — Federal Employer ID'},
      {'name':'beneficiary_name','required':True,'type':'string','hint':'Part 2, Item 1 — Beneficiary full name'},
      {'name':'beneficiary_alien_number','required':False,'type':'string','hint':'Part 2, Item 4 — A-Number'},
      {'name':'nonimmigrant_classification','required':True,'type':'string','hint':'Part 2, Item 9 — e.g. H-1B'},
      {'name':'period_of_stay_requested','required':True,'type':'string','hint':'Part 2, Item 12 — From/To dates'},
      {'name':'job_title','required':True,'type':'string','hint':'Supplement — Job title'},
      {'name':'wage_rate_of_pay','required':True,'type':'string','hint':'Supplement — Wage/salary'},
    ]},
  'i-140': {
    'form_id': 'I-140', 'form_title': 'Immigrant Petition for Alien Workers',
    'fields': [
      {'name':'petitioner_name','required':True,'type':'string','hint':'Part 1, Item 1'},
      {'name':'petitioner_ein','required':True,'type':'string','hint':'Part 1, Item 5 — EIN'},
      {'name':'beneficiary_name','required':True,'type':'string','hint':'Part 2, Item 1'},
      {'name':'beneficiary_alien_number','required':False,'type':'string','hint':'Part 2, Item 4 — A-Number'},
      {'name':'preference_classification','required':True,'type':'string','hint':'Part 2, Item 9 — EB-1/EB-2/EB-3'},
      {'name':'priority_date','required':False,'type':'date','hint':'Part 2 — Priority date if applicable'},
      {'name':'job_title','required':True,'type':'string','hint':'Part 5 — Job title'},
      {'name':'offered_wage','required':True,'type':'string','hint':'Part 5 — Offered wage'},
    ]},
  'i-797': {
    'form_id': 'I-797', 'form_title': 'Notice of Action',
    'fields': [
      {'name':'receipt_number','required':True,'type':'string','hint':'Top of notice — 13-char receipt number'},
      {'name':'notice_type','required':True,'type':'string','hint':'Notice type header'},
      {'name':'applicant_name','required':True,'type':'string','hint':'Applicant/Beneficiary name line'},
      {'name':'alien_registration_number','required':False,'type':'string','hint':'A-Number if printed'},
      {'name':'case_type','required':True,'type':'string','hint':'Case type line'},
      {'name':'notice_date','required':True,'type':'date','hint':'Notice date field'},
      {'name':'validity_start','required':False,'type':'date','hint':'Valid from date'},
      {'name':'validity_end','required':False,'type':'date','hint':'Valid to/through date'},
      {'name':'action_taken','required':True,'type':'string','hint':'Action taken / approval language'},
    ]},
  'i-751': {
    'form_id': 'I-751', 'form_title': 'Petition to Remove Conditions on Residence',
    'fields': [
      {'name':'alien_registration_number','required':True,'type':'string','hint':'Part 1, Item 1 — A-Number'},
      {'name':'family_name','required':True,'type':'string','hint':'Part 1, Item 2.a'},
      {'name':'given_name','required':True,'type':'string','hint':'Part 1, Item 2.b'},
      {'name':'date_of_birth','required':True,'type':'date','hint':'Part 1, Item 5'},
      {'name':'country_of_birth','required':True,'type':'string','hint':'Part 1, Item 7'},
      {'name':'joint_petitioner_name','required':False,'type':'string','hint':'Part 2 — Joint petitioner if applicable'},
      {'name':'date_card_expires','required':True,'type':'date','hint':'Part 1, Item 13 — Card expiry'},
      {'name':'basis_for_petition','required':True,'type':'string','hint':'Part 3 — joint/abuse_waiver/hardship_waiver/death_of_spouse'},
    ]},
  'i-130': {
    'form_id': 'I-130', 'form_title': 'Petition for Alien Relative',
    'fields': [
      {'name':'petitioner_family_name','required':True,'type':'string','hint':'Part 1, Item 1.a'},
      {'name':'petitioner_given_name','required':True,'type':'string','hint':'Part 1, Item 1.b'},
      {'name':'petitioner_dob','required':True,'type':'date','hint':'Part 1, Item 4'},
      {'name':'petitioner_alien_number','required':False,'type':'string','hint':'Part 1, Item 3 — A-Number'},
      {'name':'relationship_to_beneficiary','required':True,'type':'string','hint':'Part 3 — relationship checkbox'},
      {'name':'beneficiary_family_name','required':True,'type':'string','hint':'Part 4, Item 1.a'},
      {'name':'beneficiary_given_name','required':True,'type':'string','hint':'Part 4, Item 1.b'},
      {'name':'beneficiary_dob','required':True,'type':'date','hint':'Part 4, Item 5'},
      {'name':'beneficiary_country_of_birth','required':True,'type':'string','hint':'Part 4, Item 7'},
    ]},
  'i-131': {
    'form_id': 'I-131', 'form_title': 'Application for Travel Document',
    'fields': [
      {'name':'family_name','required':True,'type':'string','hint':'Part 1, Item 1.a'},
      {'name':'given_name','required':True,'type':'string','hint':'Part 1, Item 1.b'},
      {'name':'alien_registration_number','required':True,'type':'string','hint':'Part 1, Item 3 — A-Number'},
      {'name':'date_of_birth','required':True,'type':'date','hint':'Part 1, Item 5'},
      {'name':'class_of_admission','required':False,'type':'string','hint':'Part 1, Item 8'},
      {'name':'date_of_admission','required':False,'type':'date','hint':'Part 1, Item 9'},
      {'name':'country_of_birth','required':True,'type':'string','hint':'Part 1, Item 7'},
      {'name':'travel_document_type','required':True,'type':'string','hint':'Part 2 — advance_parole/reentry_permit/refugee_travel_document'},
      {'name':'reason_for_travel','required':False,'type':'string','hint':'Part 4 — reason'},
    ]},
  'i-539': {
    'form_id': 'I-539', 'form_title': 'Application to Extend/Change Nonimmigrant Status',
    'fields': [
      {'name':'family_name','required':True,'type':'string','hint':'Part 1, Item 1.a'},
      {'name':'given_name','required':True,'type':'string','hint':'Part 1, Item 1.b'},
      {'name':'alien_registration_number','required':False,'type':'string','hint':'Part 1, Item 3 — A-Number if any'},
      {'name':'date_of_birth','required':True,'type':'date','hint':'Part 1, Item 5'},
      {'name':'country_of_birth','required':True,'type':'string','hint':'Part 1, Item 7'},
      {'name':'current_nonimmigrant_status','required':True,'type':'string','hint':'Part 2, Item 1 — current visa class'},
      {'name':'status_expires','required':True,'type':'date','hint':'Part 2, Item 2 — status expiry date'},
      {'name':'requested_status','required':True,'type':'string','hint':'Part 2, Item 3 — requested new status'},
    ]},
  'i-765': {
    'form_id': 'I-765', 'form_title': 'Application for Employment Authorization',
    'fields': [
      {'name':'family_name','required':True,'type':'string','hint':'Part 2, Item 1.a'},
      {'name':'given_name','required':True,'type':'string','hint':'Part 2, Item 1.b'},
      {'name':'alien_registration_number','required':False,'type':'string','hint':'Part 2, Item 5 — A-Number'},
      {'name':'date_of_birth','required':True,'type':'date','hint':'Part 2, Item 9'},
      {'name':'country_of_birth','required':True,'type':'string','hint':'Part 2, Item 11'},
      {'name':'ssn','required':False,'type':'string','hint':'Part 2, Item 7 — SSN'},
      {'name':'eligibility_category','required':True,'type':'string','hint':'Part 2, Item 27 — EAD category code e.g. C09'},
      {'name':'date_eligibility_expires','required':False,'type':'date','hint':'Part 2, Item 28 — if applicable'},
    ]},
  'i-290b': {
    'form_id': 'I-290B', 'form_title': 'Notice of Appeal or Motion',
    'fields': [
      {'name':'receipt_number','required':True,'type':'string','hint':'Part 1, Item 1 — original receipt number'},
      {'name':'form_type_appealed','required':True,'type':'string','hint':'Part 1, Item 2 — form type of decision'},
      {'name':'applicant_name','required':True,'type':'string','hint':'Part 2, Item 1 — applicant name'},
      {'name':'alien_registration_number','required':False,'type':'string','hint':'Part 2, Item 3 — A-Number'},
      {'name':'date_of_decision','required':True,'type':'date','hint':'Part 3, Item 1 — decision date'},
      {'name':'reason_for_appeal','required':True,'type':'string','hint':'Part 4 or attached brief — grounds'},
      {'name':'brief_attached','required':True,'type':'string','hint':'Part 4 checkbox — Yes/No brief attached'},
    ]},
  'i-129f': {
    'form_id': 'I-129F', 'form_title': 'Petition for Alien Fiance(e)',
    'fields': [
      {'name':'petitioner_family_name','required':True,'type':'string','hint':'Part 1, Item 1.a'},
      {'name':'petitioner_given_name','required':True,'type':'string','hint':'Part 1, Item 1.b'},
      {'name':'petitioner_dob','required':True,'type':'date','hint':'Part 1, Item 4'},
      {'name':'beneficiary_family_name','required':True,'type':'string','hint':'Part 2, Item 1.a'},
      {'name':'beneficiary_given_name','required':True,'type':'string','hint':'Part 2, Item 1.b'},
      {'name':'beneficiary_dob','required':True,'type':'date','hint':'Part 2, Item 4'},
      {'name':'beneficiary_country_of_birth','required':True,'type':'string','hint':'Part 2, Item 6'},
      {'name':'date_met_beneficiary','required':True,'type':'date','hint':'Part 3, Item 1 — date met in person'},
      {'name':'prior_petitions','required':True,'type':'string','hint':'Part 3, Item 3 — Yes/No prior K-1 petitions'},
    ]},
  'n-600': {
    'form_id': 'N-600', 'form_title': 'Application for Certificate of Citizenship',
    'fields': [
      {'name':'family_name','required':True,'type':'string','hint':'Part 1, Item 1.a'},
      {'name':'given_name','required':True,'type':'string','hint':'Part 1, Item 1.b'},
      {'name':'date_of_birth','required':True,'type':'date','hint':'Part 1, Item 4'},
      {'name':'country_of_birth','required':True,'type':'string','hint':'Part 1, Item 6'},
      {'name':'alien_registration_number','required':False,'type':'string','hint':'Part 1, Item 3 — A-Number if any'},
      {'name':'us_citizen_parent_name','required':True,'type':'string','hint':'Part 3 — US citizen parent name'},
      {'name':'parent_citizenship_date','required':True,'type':'date','hint':'Part 3 — date parent became citizen'},
      {'name':'basis_for_citizenship','required':True,'type':'string','hint':'Part 2 — born_abroad/derived/naturalized_parent'},
    ]},
  'i-485-supp-j': {
    'form_id': 'I-485_SUPP_J', 'form_title': 'Supplement J — Confirmation of Bona Fide Job Offer or Request for Job Portability',
    'fields': [
      {'name':'alien_registration_number','required':True,'type':'string','hint':'Part 1, Item 1 — A-Number'},
      {'name':'family_name','required':True,'type':'string','hint':'Part 1, Item 2.a'},
      {'name':'given_name','required':True,'type':'string','hint':'Part 1, Item 2.b'},
      {'name':'principal_applicant_name','required':False,'type':'string','hint':'Part 2 — if different from Part 1'},
      {'name':'job_offer_employer','required':True,'type':'string','hint':'Part 3, Item 1 — employer company name'},
      {'name':'job_offer_title','required':True,'type':'string','hint':'Part 3, Item 5 — job title'},
      {'name':'job_offer_soc_code','required':True,'type':'string','hint':'Part 3, Item 6 — SOC code XX-XXXX.XX'},
      {'name':'portability_claim','required':True,'type':'string','hint':'Part 4 — Yes/No portability claim'},
    ]},
  'i-824': {
    'form_id': 'I-824', 'form_title': 'Application for Action on an Approved Application or Petition',
    'fields': [
      {'name':'alien_registration_number','required':True,'type':'string','hint':'Part 1, Item 1 — A-Number'},
      {'name':'family_name','required':True,'type':'string','hint':'Part 1, Item 2.a'},
      {'name':'given_name','required':True,'type':'string','hint':'Part 1, Item 2.b'},
      {'name':'original_form_type','required':True,'type':'string','hint':'Part 2, Item 1 — form type of approved petition'},
      {'name':'original_receipt_number','required':True,'type':'string','hint':'Part 2, Item 2 — 13-char receipt number'},
      {'name':'original_approval_date','required':True,'type':'date','hint':'Part 2, Item 3 — approval date'},
      {'name':'action_requested','required':True,'type':'string','hint':'Part 3 — notify_consulate/transfer_file/other'},
    ]},
  'i-90': {
    'form_id': 'I-90', 'form_title': 'Application to Replace Permanent Resident Card',
    'fields': [
      {'name':'alien_registration_number','required':True,'type':'string','hint':'Part 2, Item 1 — A-Number'},
      {'name':'family_name','required':True,'type':'string','hint':'Part 2, Item 2.a'},
      {'name':'given_name','required':True,'type':'string','hint':'Part 2, Item 2.b'},
      {'name':'date_of_birth','required':True,'type':'date','hint':'Part 2, Item 5'},
      {'name':'country_of_birth','required':True,'type':'string','hint':'Part 2, Item 7'},
      {'name':'card_expiration_date','required':False,'type':'date','hint':'Part 2, Item 10 — current card expiry'},
      {'name':'reason_for_replacement','required':True,'type':'string','hint':'Part 3 — reason code 01-14'},
    ]},
}

for fname, data in FORMS.items():
    path = skills_dir / f'{fname}.json'
    path.write_text(json.dumps(data, indent=2), encoding='utf-8')
    print(f'  wrote skills/{fname}.json ({len(data["fields"])} fields)')
