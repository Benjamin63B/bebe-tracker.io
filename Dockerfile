FROM php:8.3-apache

WORKDIR /var/www/html

COPY . /var/www/html/

RUN a2enmod rewrite headers && \
    sed -ri 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf && \
    printf '<Directory /var/www/html>\nAllowOverride All\nRequire all granted\n</Directory>\n' > /etc/apache2/conf-available/override.conf && \
    a2enconf override && \
    chown -R www-data:www-data /var/www/html

EXPOSE 80
