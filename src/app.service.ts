import { Injectable } from '@nestjs/common';
import { RentSession } from './interfaces/rentsession.interface';
import { DbProviderService } from './dbprovider/dbprovider.service';
import { CreateRentSessionDTO } from './dto/create-rentsession.dto';
import { RentResult } from './interfaces/rentresult.interface';
import { CarPercentLoad } from './interfaces/carpercentload.interface';
 
@Injectable()
export class AppService {

  constructor(private readonly dbProviderService: DbProviderService) {}

  getHello(): string {
    return 'Hello from Car-Sharing-Service!';
  }

  /**
   * Получить количество дней
   * @param {string} start начало периода
   * @param {string} end конец периода 
   * @returns количество дней
   */
  private getAmountOfDays(start: string, end: string) {
    const amountOfDays = ( (Date.parse(end) - Date.parse(start))/(1000*60*60*24) ) + 1;
    return amountOfDays;
  }

  /**
   * Получить число дней.
   * Пауза между окончанием текущего бронирования и началом следующего
   * @returns {number} число дней
   */
  private async getBufferedDays() {
    const result = await this.dbProviderService.makeQuery(`
      SELECT id, period, days 
      FROM public.maintenance_buffer
      ORDER BY period DESC 
      LIMIT 1
      ;
    `);

    const bufferedDays = result.rows.length ? parseInt(result.rows[0].days) : 0;

    return bufferedDays;
  }

  /**
   * Получить цену базовой ставки тарифа
   * @returns {number} цену в копейках
   */
  private async getBaseTax() {
    const result = await this.dbProviderService.makeQuery(`
      SELECT "id", "period", "value"
      FROM public.base_tax
      ORDER BY "period" DESC 
      LIMIT 1
      ;
    `);

    const baseTax = result.rows.length ? result.rows[0].value : 0;
    
    return baseTax;
  }

  /**
   * Получить скидки
   * @returns {Promise<{id: string, start_day: number, end_day: number, precent: number}[]>} 
   * построчно: период количества дней и процент скидки
   */
  private async getDiscounts() {
    const result = await this.dbProviderService.makeQuery(`
      SELECT "id", "start_day", "end_day", "percent"
      FROM public.discounts
      ORDER BY "start_day" ASC 
      ;
    `);

    return result.rows;
  }

  /**
   * Проверка пересечения указанного периода с периодами, на которые уже забронирована аренда.
   * Учитывается пауза между двумя разными бронированиями.
   * @param {string} start начало периода
   * @param {string} end конец периода
   * @param {string} carId внутренний id машины
   * @returns {boolean} пересекает / не пересекает
   */
  private async checkPeriodOverlaps(start: string, end: string, carId: string): Promise<boolean> {
    const bufferedDays = await this.getBufferedDays();

    const result = await this.dbProviderService.makeQuery(`
      SELECT "id", "car_id", "start", "end" 
      FROM public.rent_sessions
      WHERE car_id = '${carId}'
      AND daterange("start" - ${bufferedDays}, "end" + ${bufferedDays}, '[]') && daterange(date '${start}', date '${end}', '[]')
      ;
    `);

    return !!result.rows.length;
  }

  /**
   * Выдать информацию по 10-ти сессиям бронирования
   * @returns {Promise<RentSession[]} массив объектов RentSession
   */
  async getAllRentSessions(): Promise<RentSession[]> {
    const result = await this.dbProviderService.makeQuery(`
      SELECT rs.id, rs.car_id, cars.registration_number, rs.start, rs.end 
      FROM public.rent_sessions AS rs INNER JOIN public.cars AS cars ON rs.car_id = cars.id
      ORDER BY rs.start DESC
      LIMIT 10
      ;
    `);

    const rentSessions: RentSession[] = result.rows.map(el => (
      {
        id                     : el.id, 
        carId                  : el.car_id,
        carRegistrationNumber  : el.registration_number,
        start                  : el.start,
        end                    : el.end,
      }
    ));

    return rentSessions;
  }

  /**
   * Проверить доступность машины по рег.номеру на указанную дату
   * @param {string} registrationNumber
   * @param {string} date
   * @returns {string} ответ в виде строки
   */
  async carIsAvailable(registrationNumber: string, date: string) {
    const bufferedDays = await this.getBufferedDays();

    const result = await this.dbProviderService.makeQuery(`
      SELECT rs.id, rs.car_id, cars.registration_number, rs.start, rs.end 
      FROM public.rent_sessions AS rs INNER JOIN public.cars AS cars ON rs.car_id = cars.id
      AND cars.registration_number = '${registrationNumber}'
      AND (date '${date}' BETWEEN rs.start - ${bufferedDays} AND rs.end + ${bufferedDays}) 
      LIMIT 10
      ;
    `);

    const availabilityStatus = result.rows.length ?
      `Машина с номером ${registrationNumber} НЕ доступна на дату: ${date}` :
      `Машина с номером ${registrationNumber} доступна на дату: ${date}`;

    return availabilityStatus;
  }

  /**
   * Создание сессии аренды
   * @param {CreateRentSessionDTO} sessionData 
   * @returns {Promise<RentResult>} результат и id созданной сессии
   */
  async createRentSession(sessionData: CreateRentSessionDTO): Promise<RentResult> {
    const rentResult: RentResult = {
      result: 'positive',
      id: null
    };
    
    // количество дней аренды
    const amountOfDays = this.getAmountOfDays(sessionData.start, sessionData.end);

    // количество дней аренды не должно превышать более 30 дней
    if (amountOfDays < 1 || amountOfDays > 30) {
      rentResult.result = 'incorrect_period_length';
      return rentResult;
    }

    // начало и конец аренды может выпадать только на будние дни (пн-пт)
    // 6 -- сб
    // 0 -- вс
    if (new Date(sessionData.start).getDay() === 6 ||
        new Date(sessionData.start).getDay() === 0 ||
        new Date(sessionData.end).getDay() === 6   ||
        new Date(sessionData.end).getDay() === 0)
    {
      rentResult.result = 'holidays_overlap';
      return rentResult;
    }

    // проверка на пересечение бронирование с уже созданными в базе.
    // между окончанием бронирования и началом следующего бронирования должен быть интервал.
    const isOverlapping = await this.checkPeriodOverlaps(sessionData.start, sessionData.end, sessionData.carId);

    if (isOverlapping) {
      rentResult.result = 'period_overlaps';
      return rentResult;
    }

    const result = await this.dbProviderService.makeQuery(`
      INSERT INTO public.rent_sessions ("id", "car_id", "start", "end")
      VALUES (md5(random()::text || clock_timestamp()::text)::uuid, '${sessionData.carId}', date '${sessionData.start}', date '${sessionData.end}')
      RETURNING "id"
      ;
    `);

    const createdRentSessionId = result.rows.length ? result.rows[0].id : null;

    rentResult.id = createdRentSessionId;

    return rentResult;
  }

  /**
   * Получить отчет по средней загрузки автомобилей за период
   * @param {string} start начало периода 
   * @param {string} end конец периода
   * @returns {Promise<CarPercentLoad[]>} данные по % загрузке машины в пределах периода.
   * отношение количества дней аренды к общему количеству дней в пределах указанного периода
   */
  async getPercentLoadReport(start: string, end: string): Promise<CarPercentLoad[]> {
    const result = await this.dbProviderService.makeQuery(`
    SELECT 
      registration_number, 
      rent_days, 
      period_days, 
      round((rent_days/period_days::numeric)*100, 2)::float AS "percent_load" 
    FROM
      (SELECT 
        cars.registration_number, 
        SUM(rent_sessions.end - rent_sessions.start + 1)::integer AS rent_days, 
        (date '${end}' - date '${start}' + 1) AS period_days
      FROM 
        public.rent_sessions 
          INNER JOIN public.cars 
            ON rent_sessions.car_id = cars.id
      GROUP BY cars.registration_number) AS TMP_1
    ;
    `);

    const report: CarPercentLoad[] = result.rows;

    return report;
  }

  /**
   * Произвести расчёт стоимости аренды автомобиля за период 
   * @param {string} start начало периода
   * @param {string} end конец периода
   * @returns {number} итого (сумму)
   */
  async calculateRent(start: string, end: string) {
    const baseTax = await this.getBaseTax();
    const discounts = await this.getDiscounts();
    const amountOfDays = this.getAmountOfDays(start, end);

    // итого
    let totalSum = 0;
    // текущий этап (уровень) скидок
    let currentStage = 0;

    for (let i = 1; i <= amountOfDays; i++) {
      // больше указанного "порядкового" дня в последнем этапе не рассчитываем
      if (i > discounts[discounts.length-1].end_day) {
        break;
      }
      // проверяем "порядковый" номер дня
      // если больше последнего дня текущего этапа,
      // то переводим на следующий этап
      if (i > discounts[currentStage].end_day) {
        currentStage++;
      }
      // рассчет одного дня, в зависимости к какому этапу он относится
      // добавление рассчитанной суммы к итоговой
      totalSum += baseTax - Math.round(baseTax * discounts[currentStage].percent / 100);
    }

    //передаем значение в рублях
    return totalSum/100;
  }
}
