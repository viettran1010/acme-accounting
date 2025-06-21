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
    ticketType: TicketType,
    companyId: number,
    userRole: UserRole,
  ): Promise<User | null> {
    const assigneesLength = await User.count({
      where: { companyId, role: userRole },
    });
    if (
      !assigneesLength &&
      ticketType !== TicketType.registrationAddressChange
    ) {
      throw new ConflictException(
        `Cannot find user with role ${userRole} to create a ticket`,
      );
    }

    switch (ticketType) {
      case TicketType.registrationAddressChange: {
        const secretariesLength = await User.count({
          where: { companyId, role: UserRole.corporateSecretary },
        });

        if (secretariesLength === 0) {
          const directorsLength = await User.count({
            where: { companyId, role: UserRole.director },
          });

          if (directorsLength >= 2) {
            throw new Error(
              `Multiple directors found for company ${companyId}. Cannot assign ticket.`,
            );
          }

          if (directorsLength === 0) {
            throw new Error(
              `Cannot find user with role director to create a ticket`,
            );
          }

          return await User.findOne({
            where: { companyId, role: UserRole.director },
            order: [['createdAt', 'DESC']],
          });
        }

        break;
      }

      case TicketType.strikeOff: {
        const directorsLength = await User.count({
          where: { companyId, role: UserRole.director },
        });

        if (directorsLength >= 2) {
          throw new Error(
            `Multiple directors found for company ${companyId}. Cannot assign ticket.`,
          );
        }

        if (directorsLength === 0) {
          throw new Error(
            `Cannot find user with role director to create a ticket`,
          );
        }

        return await User.findOne({
          where: { companyId, role: UserRole.director },
          order: [['createdAt', 'DESC']],
        });
      }

      default: {
        break;
      }
    }

    return await User.findOne({
      where: { companyId, role: userRole },
      order: [['createdAt', 'DESC']],
    });
  }

  getInfos(type: TicketType) {
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

    return {
      category,
      userRole,
    };
  }

  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    const { type, companyId } = newTicketDto;
    const { category, userRole } = this.getInfos(type);

    if (userRole === UserRole.corporateSecretary) {
      const corporateSecretaryLength = await User.count({
        where: { companyId, role: UserRole.corporateSecretary },
      });

      if (corporateSecretaryLength > 1) {
        throw new ConflictException(
          `Multiple users with role ${userRole}. Cannot create a ticket`,
        );
      }
    }

    const assignee = await this.chooseAssignee(type, companyId, userRole);

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

    if (!assignee) {
      throw new Error(
        `Cannot find user with role ${userRole} to create a ticket`,
      );
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
