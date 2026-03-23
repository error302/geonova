import pdfplumber, sys, os

pdfs = [
    "The Survey Regulations.pdf",
    "Annex-6-Cadastral-Survey-and-Aerial-Mapping.pdf",
    "Cadastral_Survey_Standards_Guidelines_Manual.pdf",
    "11- 20 Survey Report new zealand.pdf",
    "1.0-LAND-SURVEY-REPORT-LOCHAB-SITE USA.pdf",
    "BIVA_Topographic_Survey_Report_FINAL_3.pdf",
    "MalaBabaganaGutti-LevellingSurvey.pdf",
    "SCSI-Geomatics-Pathway-Guide-March-2019-Updated.pdf",
    "em_1110-1-1005.pdf",
    "5_2022_06_12!12_50_55_AM.pdf",
]

for pdf_name in pdfs:
    out_name = pdf_name.replace(".pdf", ".txt")
    print(f"\n{'='*60}")
    print(f"EXTRACTING: {pdf_name}")
    print('='*60)
    try:
        with pdfplumber.open(pdf_name) as pdf:
            print(f"Pages: {len(pdf.pages)}")
            full_text = []
            for i, page in enumerate(pdf.pages):
                text = page.extract_text()
                if text:
                    full_text.append(f"\n--- PAGE {i+1} ---\n{text}")
            result = "\n".join(full_text)
            with open(out_name, "w", encoding="utf-8") as f:
                f.write(result)
            print(f"Saved {len(result)} chars to {out_name}")
            # Print first 3000 chars as preview
            print("\nPREVIEW:")
            print(result[:3000])
    except Exception as e:
        print(f"ERROR: {e}")
