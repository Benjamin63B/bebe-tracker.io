FROM php:8.3-apache

WORKDIR /var/www/html

COPY . /var/www/html/

RUN a2enmod rewrite headers && \
    printf '<Directory /var/www/html>\nAllowOverride All\nRequire all granted\n</Directory>\n' > /etc/apache2/conf-available/override.conf && \
    a2enconf override && \
    chown -R www-data:www-data /var/www/html

EXPOSE 80
