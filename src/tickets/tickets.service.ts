import { ConflictException, Injectable } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { NewTicketDto, TicketDto } from './types';

@Injectable()
export class TicketsService {
  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }

  private async checkExistingRegistrationAddressChangeTicket(
    companyId: number,
  ) {
    const existing = await Ticket.findOne({
      where: {
        companyId,
        type: TicketType.registrationAddressChange,
      },
      order: [['createdAt', 'DESC']],
    });
    if (existing) {
      throw new ConflictException(
        `Ticket with type registrationAddressChange already exists for company ${companyId}`,
      );
    }
  }

  private async handleStrikeOffTicket(companyId: number) {
    await Ticket.update(
      { status: TicketStatus.resolved },
      { where: { companyId } },
    );
  }

  private getInfos(type: TicketType) {
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

    return { category, userRole };
  }

  private async chooseAssignee(
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
        const secretaryCount = await User.count({
          where: { companyId, role: UserRole.corporateSecretary },
        });

        if (secretaryCount === 0) {
          const directorCount = await User.count({
            where: { companyId, role: UserRole.director },
          });

          if (directorCount >= 2) {
            throw new Error(
              `Multiple directors found for company ${companyId}. Cannot assign ticket.`,
            );
          }

          if (directorCount === 0) {
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
        const directorCount = await User.count({
          where: { companyId, role: UserRole.director },
        });

        if (directorCount >= 2) {
          throw new Error(
            `Multiple directors found for company ${companyId}. Cannot assign ticket.`,
          );
        }

        if (directorCount === 0) {
          throw new Error(
            `Cannot find user with role director to create a ticket`,
          );
        }

        return await User.findOne({
          where: { companyId, role: UserRole.director },
          order: [['createdAt', 'DESC']],
        });
      }

      default:
        break;
    }

    return await User.findOne({
      where: { companyId, role: userRole },
      order: [['createdAt', 'DESC']],
    });
  }

  async create(newTicketDto: NewTicketDto): Promise<TicketDto> {
    const { type, companyId } = newTicketDto;
    const { category, userRole } = this.getInfos(type);

    if (userRole === UserRole.corporateSecretary) {
      const count = await User.count({
        where: { companyId, role: UserRole.corporateSecretary },
      });

      if (count > 1) {
        throw new ConflictException(
          `Multiple users with role ${userRole}. Cannot create a ticket`,
        );
      }
    }

    const assignee = await this.chooseAssignee(type, companyId, userRole);

    switch (type) {
      case TicketType.registrationAddressChange:
        await this.checkExistingRegistrationAddressChangeTicket(companyId);
        break;

      case TicketType.strikeOff:
        await this.handleStrikeOffTicket(companyId);
        break;

      default:
        break;
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

    return {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };
  }
}
