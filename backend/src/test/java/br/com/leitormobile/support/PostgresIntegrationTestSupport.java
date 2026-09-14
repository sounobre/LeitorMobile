package br.com.leitormobile.support;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

@ActiveProfiles("test")
public abstract class PostgresIntegrationTestSupport {

    @Autowired
    private DataSource dataSource;

    @BeforeEach
    void verifyDedicatedTestDatabase() throws SQLException {
        try (
                Connection connection = dataSource.getConnection();
                Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery(
                        "select current_database(), current_schema(), current_user"
                )
        ) {
            if (!result.next()) {
                throw new IllegalStateException("Refusing backend tests: database identity query returned no row");
            }

            String database = result.getString(1);
            String schema = result.getString(2);
            String user = result.getString(3);
            if (!"leitor_test".equals(database) || !"public".equals(schema)) {
                throw new IllegalStateException(
                        "Refusing backend tests outside leitor_test/public: database="
                                + database + ", schema=" + schema + ", user=" + user
                );
            }
        }
    }
}
