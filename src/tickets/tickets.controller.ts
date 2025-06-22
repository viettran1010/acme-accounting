import { Body, Controller, Get, Post } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { NewTicketDto } from './types';

@Controller('api/v1/tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  async findAll() {
    return await this.ticketsService.findAll();
  }

  @Post()
  async create(@Body() newTicketDto: NewTicketDto) {
    return await this.ticketsService.create(newTicketDto);
  }
}
