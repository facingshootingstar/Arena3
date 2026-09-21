package com.arena3.testsupport;

import org.testng.ITestContext;
import org.testng.ITestListener;
import org.testng.ITestResult;

/**
 * Prints each test's description, pass/fail and elapsed time as it runs.
 *
 * TestNG's own reports (surefire-reports/, emailable-report.html) are built
 * for reading after the fact; this is for narrating the run live in front of
 * an audience, where "PricingServiceTest.testApplyDiscountRounding" means
 * nothing to a professor but "Kiểm tra công thức áp dụng chiết khấu và làm
 * tròn 1.000đ — PASS (4 ms)" does. Registered per-suite in the testng*.xml
 * files rather than via @Listeners on the test classes, so it stays out of
 * the test code and can be swapped per demo without touching a class.
 */
public class ConsoleNarrator implements ITestListener {

    @Override
    public void onStart(ITestContext context) {
        System.out.println();
        System.out.println("========================================");
        System.out.println(context.getSuite().getName() + " / " + context.getName());
        System.out.println("========================================");
    }

    @Override
    public void onTestStart(ITestResult result) {
        System.out.println("-> " + label(result));
    }

    @Override
    public void onTestSuccess(ITestResult result) {
        System.out.println("   PASS  (" + elapsedMs(result) + " ms)");
    }

    @Override
    public void onTestFailure(ITestResult result) {
        Throwable t = result.getThrowable();
        System.out.println("   FAIL  (" + elapsedMs(result) + " ms): "
                + (t != null ? t.getMessage() : "no exception captured"));
    }

    @Override
    public void onTestSkipped(ITestResult result) {
        System.out.println("   SKIPPED");
    }

    @Override
    public void onFinish(ITestContext context) {
        // Counted from actual results, not `getAllTestMethods().length` — a
        // @DataProvider method is one method but many runs (this suite's
        // testLookupPriceDynamic runs 4 times), so the method count and the
        // run count disagree and either one alone misleads an audience.
        int passed = context.getPassedTests().size();
        int failed = context.getFailedTests().size();
        int skipped = context.getSkippedTests().size();
        System.out.println("----------------------------------------");
        System.out.printf(
                "Tổng lượt chạy: %d   Đạt: %d   Thất bại: %d   Bỏ qua: %d%n",
                passed + failed + skipped, passed, failed, skipped);
        System.out.println();
    }

    private String label(ITestResult result) {
        String description = result.getMethod().getDescription();
        String method = result.getMethod().getMethodName();
        return (description != null && !description.isEmpty())
                ? description + "  [" + method + "]"
                : method;
    }

    private long elapsedMs(ITestResult result) {
        return result.getEndMillis() - result.getStartMillis();
    }
}
