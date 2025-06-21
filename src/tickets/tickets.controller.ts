import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';

interface newTicketDto {
  type: TicketType;
  companyId: number;
}

interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

@Controller('api/v1/tickets')
export class TicketsController {
  @Get()
  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }

  async checkExistingRegistrationAddressChangeTicket(companyId: number) {
    const existingRegistrationAddressChangeTicket = await Ticket.findOne({
      where: {
        companyId,
        type: TicketType.registrationAddressChange,
      },
      order: [['createdAt', 'DESC']],
    });
    if (existingRegistrationAddressChangeTicket) {
      throw new ConflictException(
        `Ticket with type registrationAddressChange already exists for company ${companyId}`,
      );
    }
  }

  async handleStrikeOffTicket(companyId: number) {
    await Ticket.update(
      { status: TicketStatus.resolved },
      {
        where: {
          companyId,
        },
      },
    );
  }

  async chooseAssignee(
    assignees: User[],
    ticketType: TicketType,
    companyId: number,
    userRole: UserRole,
  ): Promise<User> {
    if (
      !assignees.length &&
      ticketType !== TicketType.registrationAddressChange
    ) {
      throw new ConflictException(
        `Cannot find user with role ${userRole} to create a ticket`,
      );
    }

    switch (ticketType) {
      case TicketType.registrationAddressChange: {
        const secretaries = assignees.filter(
          (assignee) => assignee.role === UserRole.corporateSecretary,
        );

        if (secretaries.length === 0) {
          const directors = await User.findAll({
            where: { companyId, role: UserRole.director },
            order: [['createdAt', 'DESC']],
          });

          if (directors.length >= 2) {
            throw new Error(
              `Multiple directors found for company ${companyId}. Cannot assign ticket.`,
            );
          }

          if (directors.length === 0) {
            throw new Error(
              `Cannot find user with role director to create a ticket`,
            );
          }

          return directors[0];
        }

        break;
      }

      case TicketType.strikeOff: {
        const directors = await User.findAll({
          where: { companyId, role: UserRole.director },
          order: [['createdAt', 'DESC']],
        });

        if (directors.length >= 2) {
          throw new Error(
            `Multiple directors found for company ${companyId}. Cannot assign ticket.`,
          );
        }

        if (directors.length === 0) {
          throw new Error(
            `Cannot find user with role director to create a ticket`,
          );
        }

        return directors[0];
      }

      default: {
        break;
      }
    }

    return assignees[0];
  }

  async getInfos(type: TicketType, companyId: number) {
    const category =
      type === TicketType.managementReport
        ? TicketCategory.accounting
        : type === TicketType.strikeOff
          ? TicketCategory.management
          : TicketCategory.corporate;

    const userRole =
      type === TicketType.managementReport
        ? UserRole.accountant
        : UserRole.corporateSecretary;

    const assignees = await User.findAll({
      where: { companyId, role: userRole },
      order: [['createdAt', 'DESC']],
    });

    return {
      category,
      userRole,
      assignees,
    };
  }

  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    const { type, companyId } = newTicketDto;

    const { category, userRole, assignees } = await this.getInfos(
      type,
      companyId,
    );

    if (userRole === UserRole.corporateSecretary && assignees.length > 1)
      throw new ConflictException(
        `Multiple users with role ${userRole}. Cannot create a ticket`,
      );

    const assignee = await this.chooseAssignee(
      assignees,
      type,
      companyId,
      userRole,
    );

    switch (type) {
      case TicketType.registrationAddressChange: {
        await this.checkExistingRegistrationAddressChangeTicket(companyId);
        break;
      }

      case TicketType.strikeOff: {
        await this.handleStrikeOffTicket(companyId);
        break;
      }

      default: {
        break;
      }
    }

    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });

    const ticketDto: TicketDto = {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };

    return ticketDto;
  }
}
