<?php

declare(strict_types=1);

namespace Cheki;

/**
 * A request that got no HTTP response (connection failure or timeout).
 * Thrown by a transport; ChekiClient turns it into an error result.
 */
class TransportException extends \RuntimeException
{
    /** True when the attempt timed out. Timeouts are not retried. */
    public bool $timedOut;

    public function __construct(string $message, bool $timedOut = false)
    {
        parent::__construct($message);
        $this->timedOut = $timedOut;
    }
}
