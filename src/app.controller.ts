import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { RentSession } from './interfaces/rentsession.interface';
import { CreateRentSessionDTO } from './dto/create-rentsession.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Валидировать строку по формату даты.
   * Если строка невалидна,
   * то возвращает представление текущей даты 
   * в виде строки формата YYYY-MM-DD
   * @param {string} dateString 
   * @returns {string} строку в формате YYYY-MM-DD
   */
  private validateDateString(dateString?: string) {
    const dateFormat = /^\d{4}-\d{2}-\d{2}$/;

    let validatedDateString =  
      new Date().getFullYear().toString() + '-' +
      (new Date().getMonth() + 1).toString().padStart(2, '0') + '-' +
      new Date().getDate().toString().padStart(2, '0');

    if (dateString && dateString.match(dateFormat)) {
      validatedDateString = dateString.substring(0, 10);
    }

    return validatedDateString;
  }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('rent-sessions')
  async getRentSessions(): Promise<RentSession[]> {
    const rentSessions = await this.appService.getAllRentSessions();
    return rentSessions;
  }

  @Post('rent-sessions')
  async createRentSession(@Body() body: CreateRentSessionDTO) {
    const rentResult = await this.appService.createRentSession(body);

    const responses = {
      positive: `Новая сессия создана. ID: ${rentResult.id}\n Машина(внутренний id): ${body.carId}\n Период аренды: с ${body.start} по с ${body.end}`,
      incorrect_period_length: 'Невозможно создать сессию аренды. Количество дней не соответствует правилам аренды',
      holidays_overlap: 'Невозможно создать сессию аренды. Начало и конец аренды может выпадать только на будние дни (пн-пт)',
      period_overlaps: 'Невозможно создать сессию аренды. Указанный период пересекается с датами, на которые машина недоступна',
    };

    return responses[rentResult.result];
  }

  @Get('car-is-available/:registrationNumber')
  async carIsAvailableOnCurrentDate(@Param() params): Promise<string> {
    const registrationNumber = params.registrationNumber.substring(0, 9);
    const dateString = this.validateDateString();

    const availabilityStatus = await this.appService.carIsAvailable(registrationNumber, dateString);
    return availabilityStatus;
  }

  @Get('car-is-available/:registrationNumber/:date')
  async carIsAvailableOnDate(@Param() params): Promise<string> {
    const registrationNumber = params.registrationNumber.substring(0, 9);
    const dateString = this.validateDateString(params.date);
    
    const availabilityStatus = await this.appService.carIsAvailable(registrationNumber, dateString);
    return availabilityStatus;
  }

  @Get('percent-load-report/:startDate/:endDate')
  async getReport(@Param() params) {
    const start = this.validateDateString(params.startDate);
    const end = this.validateDateString(params.endDate);

    const dataRows = await this.appService.getPercentLoadReport(start, end);

    // сумма всех дней в аренде
    const totalRentDays = dataRows.reduce((prev, cur) => (prev + cur.rent_days), 0);
    // сумма всех дней в периоде -- равнозначно: (количество машин) * (количество дней в периоде)
    const totalPeriodDays = dataRows.reduce((prev, cur) => (prev + cur.period_days), 0);
    // сумма всех процентов
    const sumPercentLoad = dataRows.reduce((prev, cur) => (prev + cur.percent_load), 0.0);
    // отношение (суммы всех дней в аренде) / (количество машин) * (количество дней в периоде) 
    const totalPercentLoad = (totalRentDays / totalPeriodDays) * 100;

    return {
      dataRows,
      amountOfCars: dataRows.length, // количество машин
      totalRentDays,
      totalPeriodDays,
      sumPercentLoad,
      totalPercentLoad
    };
  }

  @Get('calculate-rent/:startDate/:endDate')
  async calculateRent(@Param() params) {
    const totalPrice = await this.appService.calculateRent(params.startDate, params.endDate);
    
    return `
      Цена за указанный период аренды: с ${params.startDate} по ${params.endDate}\n
      Составит: ${totalPrice} руб.
    `;
  }
}
