from app.core.exceptions import ValidationError

MAX_SEQUENCE_LENGTH = 5_000_000

# Full IUPAC nucleotide alphabet (DNA + RNA + degenerate codes + gap)
# R=A/G, Y=C/T, S=G/C, W=A/T, K=G/T, M=A/C, B=C/G/T, D=A/G/T, H=A/C/T, V=A/C/G
VALID_DNA_BASES = set("ATGCNURYSWKMBDHVatgcnuryswkmbdhv-")

# Standard IUPAC amino acid single-letter codes including:
# U=Selenocysteine, O=Pyrrolysine, X=unknown/any, B=Asx (Asp/Asn), Z=Glx (Glu/Gln),
# J=Leu/Ile, *=stop/termination, -=gap
VALID_PROTEIN_AMINO_ACIDS = set("ACDEFGHIKLMNPQRSTVWYUBZXOJacdefghiklmnpqrstvwyubzxoj*-")


def validate_sequence_length(sequence: str, max_length: int = MAX_SEQUENCE_LENGTH) -> None:
    if len(sequence) > max_length:
        raise ValidationError(
            f"Sequence length ({len(sequence)}) exceeds maximum allowed length of {max_length} characters."
        )


def validate_dna_sequence(sequence: str) -> None:
    if not sequence:
        raise ValidationError("Sequence cannot be empty.")
    validate_sequence_length(sequence)
    clean_seq = sequence.replace(" ", "").replace("\n", "").replace("\r", "").strip()
    invalid = {char for char in clean_seq if char not in VALID_DNA_BASES}
    if invalid:
        raise ValidationError(f"Invalid DNA/RNA sequence. Unsupported characters: {sorted(invalid)}")


def validate_protein_sequence(sequence: str) -> None:
    if not sequence:
        raise ValidationError("Sequence cannot be empty.")
    validate_sequence_length(sequence)
    clean_seq = sequence.replace(" ", "").replace("\n", "").replace("\r", "").strip()
    invalid = {char for char in clean_seq if char not in VALID_PROTEIN_AMINO_ACIDS}
    if invalid:
        raise ValidationError(f"Invalid protein sequence. Unsupported characters: {sorted(invalid)}")
