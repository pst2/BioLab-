from app.core.exceptions import ValidationError


VALID_DNA_BASES = {"A", "T", "G", "C", "N"}


def validate_dna_sequence(sequence: str) -> None:
    invalid = {char for char in sequence if char not in VALID_DNA_BASES}
    if invalid:
        raise ValidationError(f"Invalid DNA sequence. Unsupported characters: {sorted(invalid)}")
