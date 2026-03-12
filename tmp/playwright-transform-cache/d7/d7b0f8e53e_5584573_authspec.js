"use strict";

var _test = require("@playwright/test");
_test.test.describe('Authentication', () => {
  (0, _test.test)('should redirect to login unauthenticated user', async ({
    page
  }) => {
    await page.goto('/dashboard');
    // Expect to be redirected to signin, or at least not show dashboard content
    // Since NextAuth usually redirects to /api/auth/signin or custom login
    await (0, _test.expect)(page.url()).toContain('api/auth/signin');
  });

  // Since we are mocking auth in E2E usually, or need a real user.
  // For this MVP, we will assume a "skip auth" mode or just check public pages if any.
  // But wait, the app is protected. 
  // We can simulate a logged-in state by setting cookies if we had a seed script, 
  // or we can test the Login UI if it exists.

  (0, _test.test)('should show login options', async ({
    page
  }) => {
    await page.goto('/api/auth/signin');
    await (0, _test.expect)(page.getByText('Sign in with Google')).toBeVisible();
    await (0, _test.expect)(page.getByText('Sign in with Email')).toBeVisible();
  });
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfdGVzdCIsInJlcXVpcmUiLCJ0ZXN0IiwiZGVzY3JpYmUiLCJwYWdlIiwiZ290byIsImV4cGVjdCIsInVybCIsInRvQ29udGFpbiIsImdldEJ5VGV4dCIsInRvQmVWaXNpYmxlIl0sInNvdXJjZXMiOlsiYXV0aC5zcGVjLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIlxyXG5pbXBvcnQgeyB0ZXN0LCBleHBlY3QgfSBmcm9tICdAcGxheXdyaWdodC90ZXN0JztcclxuXHJcbnRlc3QuZGVzY3JpYmUoJ0F1dGhlbnRpY2F0aW9uJywgKCkgPT4ge1xyXG4gICAgdGVzdCgnc2hvdWxkIHJlZGlyZWN0IHRvIGxvZ2luIHVuYXV0aGVudGljYXRlZCB1c2VyJywgYXN5bmMgKHsgcGFnZSB9KSA9PiB7XHJcbiAgICAgICAgYXdhaXQgcGFnZS5nb3RvKCcvZGFzaGJvYXJkJyk7XHJcbiAgICAgICAgLy8gRXhwZWN0IHRvIGJlIHJlZGlyZWN0ZWQgdG8gc2lnbmluLCBvciBhdCBsZWFzdCBub3Qgc2hvdyBkYXNoYm9hcmQgY29udGVudFxyXG4gICAgICAgIC8vIFNpbmNlIE5leHRBdXRoIHVzdWFsbHkgcmVkaXJlY3RzIHRvIC9hcGkvYXV0aC9zaWduaW4gb3IgY3VzdG9tIGxvZ2luXHJcbiAgICAgICAgYXdhaXQgZXhwZWN0KHBhZ2UudXJsKCkpLnRvQ29udGFpbignYXBpL2F1dGgvc2lnbmluJyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTaW5jZSB3ZSBhcmUgbW9ja2luZyBhdXRoIGluIEUyRSB1c3VhbGx5LCBvciBuZWVkIGEgcmVhbCB1c2VyLlxyXG4gICAgLy8gRm9yIHRoaXMgTVZQLCB3ZSB3aWxsIGFzc3VtZSBhIFwic2tpcCBhdXRoXCIgbW9kZSBvciBqdXN0IGNoZWNrIHB1YmxpYyBwYWdlcyBpZiBhbnkuXHJcbiAgICAvLyBCdXQgd2FpdCwgdGhlIGFwcCBpcyBwcm90ZWN0ZWQuIFxyXG4gICAgLy8gV2UgY2FuIHNpbXVsYXRlIGEgbG9nZ2VkLWluIHN0YXRlIGJ5IHNldHRpbmcgY29va2llcyBpZiB3ZSBoYWQgYSBzZWVkIHNjcmlwdCwgXHJcbiAgICAvLyBvciB3ZSBjYW4gdGVzdCB0aGUgTG9naW4gVUkgaWYgaXQgZXhpc3RzLlxyXG5cclxuICAgIHRlc3QoJ3Nob3VsZCBzaG93IGxvZ2luIG9wdGlvbnMnLCBhc3luYyAoeyBwYWdlIH0pID0+IHtcclxuICAgICAgICBhd2FpdCBwYWdlLmdvdG8oJy9hcGkvYXV0aC9zaWduaW4nKTtcclxuICAgICAgICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVRleHQoJ1NpZ24gaW4gd2l0aCBHb29nbGUnKSkudG9CZVZpc2libGUoKTtcclxuICAgICAgICBhd2FpdCBleHBlY3QocGFnZS5nZXRCeVRleHQoJ1NpZ24gaW4gd2l0aCBFbWFpbCcpKS50b0JlVmlzaWJsZSgpO1xyXG4gICAgfSk7XHJcbn0pO1xyXG4iXSwibWFwcGluZ3MiOiI7O0FBQ0EsSUFBQUEsS0FBQSxHQUFBQyxPQUFBO0FBRUFDLFVBQUksQ0FBQ0MsUUFBUSxDQUFDLGdCQUFnQixFQUFFLE1BQU07RUFDbEMsSUFBQUQsVUFBSSxFQUFDLCtDQUErQyxFQUFFLE9BQU87SUFBRUU7RUFBSyxDQUFDLEtBQUs7SUFDdEUsTUFBTUEsSUFBSSxDQUFDQyxJQUFJLENBQUMsWUFBWSxDQUFDO0lBQzdCO0lBQ0E7SUFDQSxNQUFNLElBQUFDLFlBQU0sRUFBQ0YsSUFBSSxDQUFDRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUNDLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQztFQUN6RCxDQUFDLENBQUM7O0VBRUY7RUFDQTtFQUNBO0VBQ0E7RUFDQTs7RUFFQSxJQUFBTixVQUFJLEVBQUMsMkJBQTJCLEVBQUUsT0FBTztJQUFFRTtFQUFLLENBQUMsS0FBSztJQUNsRCxNQUFNQSxJQUFJLENBQUNDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztJQUNuQyxNQUFNLElBQUFDLFlBQU0sRUFBQ0YsSUFBSSxDQUFDSyxTQUFTLENBQUMscUJBQXFCLENBQUMsQ0FBQyxDQUFDQyxXQUFXLENBQUMsQ0FBQztJQUNqRSxNQUFNLElBQUFKLFlBQU0sRUFBQ0YsSUFBSSxDQUFDSyxTQUFTLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDQyxXQUFXLENBQUMsQ0FBQztFQUNwRSxDQUFDLENBQUM7QUFDTixDQUFDLENBQUMiLCJpZ25vcmVMaXN0IjpbXX0=