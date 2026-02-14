FROM php:8.4-cli

# 安裝系統依賴
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    zip \
    unzip

# 安裝 PHP 擴展
RUN docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip

# 安裝 Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 設定工作目錄
WORKDIR /app

# 複製 composer 檔案
COPY composer.json composer.lock ./

# 安裝依賴
RUN composer install --no-dev --optimize-autoloader --no-scripts

# 複製其餘程式碼
COPY . .

# 執行 post-install 腳本
RUN composer dump-autoload --optimize


# 暴露 port
EXPOSE 8080

# 啟動指令
CMD php artisan storage:link --force && php artisan migrate --force && php artisan db:seed --class=UserSeeder --force && php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
