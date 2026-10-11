<?php

declare(strict_types=1);

// Minimal PSR-4 autoloader so the tests run without `composer install`.
spl_autoload_register(static function (string $class): void {
    if (str_starts_with($class, 'Cheki\\')) {
        $file = __DIR__ . '/../src/' . substr($class, 6) . '.php';
        if (is_file($file)) {
            require $file;
        }
    }
});
