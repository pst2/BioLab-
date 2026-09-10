"""
mock_blast.py - Bundled BLAST reference results for offline and emergency fallback.

Follows the design of mock_genes.py and mock_pubmed.py.
"""
from typing import Any

MOCK_BLAST_RESULTS: dict[str, list[dict[str, Any]]] = {
    # Human KRAS protein (SwissProt P01116)
    "kras_protein": [
        {
            "accession": "P01116",
            "description": "GTPase KRas OS=Homo sapiens OX=9606 GN=KRAS PE=1 SV=1",
            "e_value": 0.0,
            "identity_percent": 100.0,
            "query_coverage_percent": 100.0,
            "alignment_length": 188,
            "bit_score": 388.0,
            "gaps": 0,
            "query_seq": "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLPSRTVDTKQAQDLARSYGIPFIETSAKTRQGVDDAFYTLVREIRKHKEKMSKDGKKKKKKSKTKCIM",
            "match_seq": "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLPSRTVDTKQAQDLARSYGIPFIETSAKTRQGVDDAFYTLVREIRKHKEKMSKDGKKKKKKSKTKCIM",
            "subject_seq": "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLPSRTVDTKQAQDLARSYGIPFIETSAKTRQGVDDAFYTLVREIRKHKEKMSKDGKKKKKKSKTKCIM",
            "query_from": 1,
            "query_to": 188,
            "hit_from": 1,
            "hit_to": 188,
            "source": "local_mock",
        },
        {
            "accession": "P01112",
            "description": "GTPase HRas OS=Homo sapiens OX=9606 GN=HRAS PE=1 SV=1",
            "e_value": 1.2e-115,
            "identity_percent": 84.6,
            "query_coverage_percent": 98.4,
            "alignment_length": 189,
            "bit_score": 332.0,
            "gaps": 2,
            "query_seq": "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLPSRTVDTKQAQDLARSYGIPFIETSAKTRQGVDDAFYTLVREIRKHKEKMSKDGKKKKKKSKTKCIM",
            "match_seq": "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLP+RTVDTKQAQDLARSYGIPFIETSAKTRQGVDDAFYTLVREIR++K +   +GKKKKKKSK +C+",
            "subject_seq": "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHQYREQIKRVKDSDDVPMVLVGNKCDLAARTVDTKQAQDLARSYGIPFIETSAKTRQGVEDAFYTLVREIRQHKLRKLNPPDESGPGCMSCKCVI",
            "query_from": 1,
            "query_to": 188,
            "hit_from": 1,
            "hit_to": 189,
            "source": "local_mock",
        },
        {
            "accession": "P01111",
            "description": "GTPase NRas OS=Homo sapiens OX=9606 GN=NRAS PE=1 SV=1",
            "e_value": 3.5e-112,
            "identity_percent": 86.2,
            "query_coverage_percent": 98.4,
            "alignment_length": 189,
            "bit_score": 325.0,
            "gaps": 1,
            "query_seq": "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLPSRTVDTKQAQDLARSYGIPFIETSAKTRQGVDDAFYTLVREIRKHKEKMSKDGKKKKKKSKTKCIM",
            "match_seq": "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLPSRTVDTKQAQDLARSYGIPFIETSAKTRQGVDDAFYTLVREIR++  +  +  +  +  + +KC+M",
            "subject_seq": "MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGEGFLCVFAINNTKSFEDIHHYREQIKRVKDSEDVPMVLVGNKCDLPSRTVDTKQAQDLARSYGIPFIETSAKTRQGVDDAFYTLVREIRQYRMKKLNSSDDGTQGCMGLPCVVM",
            "query_from": 1,
            "query_to": 188,
            "hit_from": 1,
            "hit_to": 189,
            "source": "local_mock",
        },
    ],
    # Human KRAS DNA
    "kras_dna": [
        {
            "accession": "NM_004985.5",
            "description": "Homo sapiens KRAS proto-oncogene, transcript variant b, mRNA",
            "e_value": 0.0,
            "identity_percent": 100.0,
            "query_coverage_percent": 100.0,
            "alignment_length": 240,
            "bit_score": 444.0,
            "gaps": 0,
            "query_seq": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGATCCAACAATAGAGGATTCCTACAGGAAGCAAGTAGTAATTGATGGAGAAACCTGTCTCTTGGATATTCTCGACACAGCAGGTCAAGAGGAGTACAGTGCAATGAGGGACCAGTACATGAGGACTGGGGAGGGCTTTCTTTGTGTATTTGCCATAAATAAT",
            "match_seq": "||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||",
            "subject_seq": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGATCCAACAATAGAGGATTCCTACAGGAAGCAAGTAGTAATTGATGGAGAAACCTGTCTCTTGGATATTCTCGACACAGCAGGTCAAGAGGAGTACAGTGCAATGAGGGACCAGTACATGAGGACTGGGGAGGGCTTTCTTTGTGTATTTGCCATAAATAAT",
            "query_from": 1,
            "query_to": 240,
            "hit_from": 190,
            "hit_to": 429,
            "source": "local_mock",
        },
        {
            "accession": "NM_033360.4",
            "description": "Homo sapiens KRAS proto-oncogene, transcript variant a, mRNA",
            "e_value": 0.0,
            "identity_percent": 100.0,
            "query_coverage_percent": 100.0,
            "alignment_length": 240,
            "bit_score": 444.0,
            "gaps": 0,
            "query_seq": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGATCCAACAATAGAGGATTCCTACAGGAAGCAAGTAGTAATTGATGGAGAAACCTGTCTCTTGGATATTCTCGACACAGCAGGTCAAGAGGAGTACAGTGCAATGAGGGACCAGTACATGAGGACTGGGGAGGGCTTTCTTTGTGTATTTGCCATAAATAAT",
            "match_seq": "||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||",
            "subject_seq": "ATGACTGAATATAAACTTGTGGTAGTTGGAGCTGGTGGCGTAGGCAAGAGTGCCTTGACGATACAGCTAATTCAGAATCATTTTGTGGACGAATATGATCCAACAATAGAGGATTCCTACAGGAAGCAAGTAGTAATTGATGGAGAAACCTGTCTCTTGGATATTCTCGACACAGCAGGTCAAGAGGAGTACAGTGCAATGAGGGACCAGTACATGAGGACTGGGGAGGGCTTTCTTTGTGTATTTGCCATAAATAAT",
            "query_from": 1,
            "query_to": 240,
            "hit_from": 190,
            "hit_to": 429,
            "source": "local_mock",
        },
    ],
}


def get_mock_blast_hits(sequence: str, seq_type: str = "protein") -> list[dict[str, Any]] | None:
    """Check if sequence matches any bundled mock results."""
    clean = sequence.strip().upper().replace(" ", "").replace("\r", "").replace("\n", "")
    if clean.startswith(">"):
        lines = clean.split("\n")
        clean = "".join(lines[1:])

    # Match KRAS protein or substring
    if seq_type == "protein" or ("MTEYK" in clean and "TKCIM" in clean):
        if "MTEYKLVVVGAGGVGKSALTIQL" in clean:
            return list(MOCK_BLAST_RESULTS["kras_protein"])

    # Match KRAS DNA or substring
    if seq_type == "dna" or ("ATGACTGAAT" in clean and "TAAATAAT" in clean):
        if "ATGACTGAATATAAACTTGTGGTAGTTGGAGC" in clean:
            return list(MOCK_BLAST_RESULTS["kras_dna"])

    return None
