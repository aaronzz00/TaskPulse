import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'projects',
})
export class WebSocketGatewayService
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGatewayService.name);
  private userProjectRooms: Map<string, Set<string>> = new Map();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.userProjectRooms.set(client.id, new Set());
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const rooms = this.userProjectRooms.get(client.id);
    if (rooms) {
      rooms.forEach((room) => {
        client.leave(room);
      });
    }
    this.userProjectRooms.delete(client.id);
  }

  @SubscribeMessage('joinProject')
  handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody('projectId') projectId: string,
  ) {
    const roomName = `project:${projectId}`;
    client.join(roomName);

    const userRooms = this.userProjectRooms.get(client.id);
    if (userRooms) {
      userRooms.add(roomName);
    }

    this.logger.log(`Client ${client.id} joined project room: ${roomName}`);

    return {
      event: 'joinedProject',
      data: { projectId, roomName },
    };
  }

  @SubscribeMessage('leaveProject')
  handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody('projectId') projectId: string,
  ) {
    const roomName = `project:${projectId}`;
    client.leave(roomName);

    const userRooms = this.userProjectRooms.get(client.id);
    if (userRooms) {
      userRooms.delete(roomName);
    }

    this.logger.log(`Client ${client.id} left project room: ${roomName}`);

    return {
      event: 'leftProject',
      data: { projectId, roomName },
    };
  }

  @SubscribeMessage('taskUpdated')
  handleTaskUpdated(
    @MessageBody() data: { projectId: string; taskId: string; status: string },
  ) {
    const roomName = `project:${data.projectId}`;
    this.server.to(roomName).emit('taskUpdated', {
      taskId: data.taskId,
      status: data.status,
      projectId: data.projectId,
      timestamp: new Date(),
    });

    this.logger.log(
      `Task ${data.taskId} updated in project ${data.projectId}, broadcasting to room ${roomName}`,
    );
  }

  @SubscribeMessage('taskCreated')
  handleTaskCreated(
    @MessageBody() data: { projectId: string; task: any },
  ) {
    const roomName = `project:${data.projectId}`;
    this.server.to(roomName).emit('taskCreated', {
      task: data.task,
      projectId: data.projectId,
      timestamp: new Date(),
    });

    this.logger.log(
      `New task created in project ${data.projectId}, broadcasting to room ${roomName}`,
    );
  }

  @SubscribeMessage('taskDeleted')
  handleTaskDeleted(
    @MessageBody() data: { projectId: string; taskId: string },
  ) {
    const roomName = `project:${data.projectId}`;
    this.server.to(roomName).emit('taskDeleted', {
      taskId: data.taskId,
      projectId: data.projectId,
      timestamp: new Date(),
    });

    this.logger.log(
      `Task ${data.taskId} deleted from project ${data.projectId}, broadcasting to room ${roomName}`,
    );
  }

  @SubscribeMessage('projectUpdated')
  handleProjectUpdated(
    @MessageBody() data: { projectId: string; updates: any },
  ) {
    const roomName = `project:${data.projectId}`;
    this.server.to(roomName).emit('projectUpdated', {
      projectId: data.projectId,
      updates: data.updates,
      timestamp: new Date(),
    });

    this.logger.log(
      `Project ${data.projectId} updated, broadcasting to room ${roomName}`,
    );
  }

  @SubscribeMessage('insightGenerated')
  handleInsightGenerated(
    @MessageBody() data: { projectId: string; insight: any },
  ) {
    const roomName = `project:${data.projectId}`;
    this.server.to(roomName).emit('insightGenerated', {
      insight: data.insight,
      projectId: data.projectId,
      timestamp: new Date(),
    });

    this.logger.log(
      `New insight generated for project ${data.projectId}, broadcasting to room ${roomName}`,
    );
  }

  broadcastToProject(
    projectId: string,
    event: string,
    data: any,
  ) {
    const roomName = `project:${projectId}`;
    this.server.to(roomName).emit(event, {
      ...data,
      timestamp: new Date(),
    });

    this.logger.log(
      `Broadcasting event "${event}" to project room ${roomName}`,
    );
  }

  getClientsInProject(projectId: string): number {
    const roomName = `project:${projectId}`;
    const room = this.server.sockets.adapter.rooms.get(roomName);
    return room ? room.size : 0;
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return {
      event: 'pong',
      data: { timestamp: new Date() },
    };
  }
}
