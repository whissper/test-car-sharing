# test-car-sharing
test-car-sharing (simple NodeJS service)

## Тестовое задание "Расчет стоимости аренды автомобилей"

### Сервис:
для запуска сервиса необходимо:

- склонировать репозиторий;

- проинсталлировать все зависимости:
```
$ npm install 
```
- запуск сервиса:
```
$ npm run start
```

### БД:
в корне проекта есть файл <code>postgres</code> 
Его можно использовать в качестве импорта структуры БД (PostgreSQL 13.4)

### API:
Параметры (примеры) :
- <code>:registrationNumber</code> -- <code>A999AA999</code>
- <code>:startDate</code> -- <code>2022-01-01</code>
- <code>:endDate</code> -- <code>2022-01-31</code>
- <code>:date</code> -- <code>2022-03-06</code>

Сообщение приветствия:
```
GET:  http://localhost:3000/
```
Выдать информацию по 10-ти сессиям бронирования:
```
GET:  http://localhost:3000/rent-sessions
```
Создание сессии аренды:
```
POST: http://localhost:3000/rent-sessions { "carId": "...", "start": "2022-01-01", "end": "2022-01-31" }
```
Проверить доступность машины по рег.номеру на текущую дату:
```
GET:  http://localhost:3000/car-is-available/:registrationNumber
```
Проверить доступность машины по рег.номеру на указанную дату:
```
GET:  http://localhost:3000/car-is-available/:registrationNumber/:date
```
Получить отчет по средней загрузки автомобилей за период:
```
GET:  http://localhost:3000/percent-load-report/:startDate/:endDate
```
Произвести расчёт стоимости аренды автомобиля за период:
```
GET:  http://localhost:3000/calculate-rent/:startDate/:endDate
```
