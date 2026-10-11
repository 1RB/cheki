<?php

declare(strict_types=1);

namespace Cheki;

/**
 * One receipt format of a bank, from GET /api/banks. A bank's formats come
 * current first: lead with the first one, offer the rest as older receipts.
 */
class ReceiptFormat
{
    public string $id;
    /** 'current', 'legacy' (still works) or 'deprecated' (links only read for their reference). */
    public string $status;
    public string $label;
    /** @var list<string> What the format needs: 'reference', 'receiptId', 'link', 'account', 'phone'. */
    public array $inputs;
    /** Trailing account digits, when the format needs an account. */
    public ?int $accountDigits;
    public string $responseType;
    /** False when cheki documents the format but can't check it yet. */
    public bool $supported;
    /** 'verified' (observed by cheki) or 'inferred'. */
    public string $confidence;

    /** @param list<string> $inputs */
    public function __construct(
        string $id = '',
        string $status = '',
        string $label = '',
        array $inputs = [],
        ?int $accountDigits = null,
        string $responseType = '',
        bool $supported = false,
        string $confidence = ''
    ) {
        $this->id            = $id;
        $this->status        = $status;
        $this->label         = $label;
        $this->inputs        = $inputs;
        $this->accountDigits = $accountDigits;
        $this->responseType  = $responseType;
        $this->supported     = $supported;
        $this->confidence    = $confidence;
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $str = static fn (string $k): string => isset($data[$k]) && is_scalar($data[$k]) ? (string) $data[$k] : '';
        $inputs = [];
        foreach ((array) ($data['inputs'] ?? []) as $i) {
            if (is_string($i)) {
                $inputs[] = $i;
            }
        }
        return new self(
            id:            $str('id'),
            status:        $str('status'),
            label:         $str('label'),
            inputs:        $inputs,
            accountDigits: isset($data['accountDigits']) && is_numeric($data['accountDigits']) ? (int) $data['accountDigits'] : null,
            responseType:  $str('responseType'),
            supported:     ($data['supported'] ?? false) === true,
            confidence:    $str('confidence')
        );
    }
}
