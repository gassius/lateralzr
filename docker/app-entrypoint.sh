#!/bin/sh
# Prepare the bind-mounted storage tree, then exec the container command.
# PHP-FPM master stays root (workers are www-data). Artisan runs as www-data
# so queue/scheduler cannot recreate root:root laravel.log files.
set -eu

cd /var/www/html

mkdir -p \
    storage/app/public \
    storage/app/private \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/testing \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

if [ "$(id -u)" = "0" ]; then
    chown -R www-data:www-data storage bootstrap/cache || true
    chmod -R ug+rwX,o+rX storage bootstrap/cache || true
fi

# public/ lives in the image (not bind-mounted). Recreate the storage symlink
# on every start so `php artisan about` reports public/storage as linked.
if [ -e public/storage ] && [ ! -L public/storage ]; then
    rm -rf public/storage
fi
ln -sfn /var/www/html/storage/app/public /var/www/html/public/storage

if [ "$(id -u)" = "0" ] && [ "${1:-}" != "php-fpm" ]; then
    exec gosu www-data "$@"
fi

exec "$@"
