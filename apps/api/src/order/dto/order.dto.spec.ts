import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { CancelOrderDto } from "./order.dto.js";
describe("Cancellation reason validation",()=>{
 it.each(["qq","Khách yêu cầu hủy","x".repeat(500)])("accepts text reason %s",async reason=>{expect(await validate(Object.assign(new CancelOrderDto(),{reason}))).toHaveLength(0)});
 it("rejects overlong and non-text reasons",async()=>{for(const reason of ["x".repeat(501),123])expect((await validate(Object.assign(new CancelOrderDto(),{reason}))).length).toBeGreaterThan(0)});
});
