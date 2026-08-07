import pytest
from app.core.exceptions import ValidationError
from app.utils.validators import (
    validate_dna_sequence,
    validate_protein_sequence,
    validate_sequence_length,
)


def test_validate_sequence_length_pass():
    validate_sequence_length("A" * 1000)


def test_validate_sequence_length_fail():
    with pytest.raises(ValidationError) as exc:
        validate_sequence_length("A" * 50001)
    assert "exceeds maximum allowed length" in str(exc.value)


def test_validate_dna_sequence_valid():
    validate_dna_sequence("ATGCGTANACGU")
    validate_dna_sequence("atgcgtanacgu")


def test_validate_dna_sequence_invalid_chars():
    with pytest.raises(ValidationError) as exc:
        validate_dna_sequence("ATGCPZ")
    assert "Invalid DNA/RNA sequence" in str(exc.value)


def test_validate_dna_sequence_empty():
    with pytest.raises(ValidationError) as exc:
        validate_dna_sequence("")
    assert "cannot be empty" in str(exc.value)


def test_validate_protein_sequence_valid():
    validate_protein_sequence("MKTLLILAVIMACAA")


def test_validate_protein_sequence_invalid_chars():
    with pytest.raises(ValidationError) as exc:
        validate_protein_sequence("MKTL!@#")
    assert "Invalid protein sequence" in str(exc.value)
