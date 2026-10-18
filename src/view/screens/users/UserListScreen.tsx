import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getCurrentUser,
  getValidAuthSession,
  isAuthSessionError,
  listUsers,
} from '@/src/lib/api/campus';
import type { CampusUser } from '@/src/lib/api/campus';
import { clearAuthToken } from '@/src/lib/auth/token';

type RoleFilter = 'all' | 'student' | 'professor';
type StatusFilter = 'all' | 'active' | 'inactive';

export default function UserListScreen() {
  const router = useRouter();

  const [users, setUsers] = useState<CampusUser[]>([]);
  const [currentUser, setCurrentUser] = useState<CampusUser | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadUsers = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);
    setProfileError(null);

    try {
      const session = await getValidAuthSession();
      if (session.payload.role !== 'professor' && session.payload.role !== 'admin') {
        router.replace('/(tabs)' as never);
        return;
      }

      const [usersResult, profileResult] = await Promise.allSettled([
        listUsers(),
        getCurrentUser(),
      ]);

      const usersAuthError =
        usersResult.status === 'rejected' &&
        isAuthSessionError(usersResult.reason);

      const profileAuthError =
        profileResult.status === 'rejected' &&
        isAuthSessionError(profileResult.reason);

      if (usersAuthError || profileAuthError) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      } else {
        setError(
          usersResult.reason instanceof Error
            ? usersResult.reason.message
            : 'Não foi possível carregar os usuários.',
        );
      }

      if (profileResult.status === 'fulfilled') {
        setCurrentUser(profileResult.value);
      } else {
        setProfileError(
          profileResult.reason instanceof Error
            ? profileResult.reason.message
            : 'Não foi possível carregar seu perfil.',
        );
      }
    } catch (requestError) {
      if (isAuthSessionError(requestError)) {
        await clearAuthToken();
        router.replace('/login' as never);
        return;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Ocorreu um erro ao carregar os dados.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadUsers();
    }, [loadUsers]),
  );

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    return users.filter((user) => {
      const fullName =
        `${user.name} ${user.last_name}`.toLocaleLowerCase();
      const email = user.email.toLocaleLowerCase();

      const matchesSearch =
        normalizedSearch.length === 0 ||
        fullName.includes(normalizedSearch) ||
        email.includes(normalizedSearch);

      const matchesRole =
        roleFilter === 'all' || user.role === roleFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.is_active) ||
        (statusFilter === 'inactive' && !user.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sair da conta',
      'Deseja realmente encerrar sua sessão?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await clearAuthToken();
                router.replace('/login' as never);
              } catch {
                Alert.alert(
                  'Erro',
                  'Não foi possível encerrar a sessão.',
                );
              }
            })();
          },
        },
      ],
    );
  }, [router]);

  const openStatusFilter = useCallback(() => {
    Alert.alert(
      'Filtrar por status',
      'Quais usuários você deseja visualizar?',
      [
        {
          text: 'Todos',
          onPress: () => setStatusFilter('all'),
        },
        {
          text: 'Ativos',
          onPress: () => setStatusFilter('active'),
        },
        {
          text: 'Inativos',
          onPress: () => setStatusFilter('inactive'),
        },
        {
          text: 'Cancelar',
          style: 'cancel',
        },
      ],
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          data={filteredUsers}
          keyExtractor={(user) => String(user.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void loadUsers(true)}
              colors={['#D0A900']}
              tintColor="#D0A900"
            />
          }
          ListHeaderComponent={
            <View>
              <Text style={styles.pageTitle}>Usuários</Text>

              <Text style={styles.pageSubtitle}>
                Gerencie sua conta e os acessos ao sistema.
              </Text>

              {/* Resumo compacto da conta autenticada */}
              <View style={styles.profileCard}>
                <View style={styles.profileRow}>
                  <View style={styles.profileAvatar}>
                    {currentUser?.profile_picture_url ? (
                      <Image
                        source={{
                          uri: currentUser.profile_picture_url,
                        }}
                        contentFit="cover"
                        style={styles.profileAvatarImage}
                      />
                    ) : currentUser ? (
                      <Text style={styles.profileInitials}>
                        {`${currentUser.name.trim().charAt(0)}${currentUser.last_name.trim().charAt(0)}`.toUpperCase()}
                      </Text>
                    ) : (
                      <MaterialIcons
                        name="person"
                        size={25}
                        color="#171717"
                      />
                    )}
                  </View>

                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {currentUser
                        ? `${currentUser.name} ${currentUser.last_name}`
                        : 'Minha conta'}
                    </Text>

                    <Text style={styles.profileEmail} numberOfLines={1}>
                      {currentUser?.email ?? 'Carregando perfil...'}
                    </Text>

                    {currentUser ? (
                      <Text style={styles.profileRole}>
                        {roleLabel(currentUser.role)}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {profileError ? (
                  <Text style={styles.profileError}>
                    {profileError}
                  </Text>
                ) : null}

                <View style={styles.profileActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!currentUser}
                    onPress={() => router.push('/perfil' as never)}
                    style={[
                      styles.profileButton,
                      !currentUser && styles.disabledButton,
                    ]}
                  >
                    <MaterialIcons
                      name="person-outline"
                      size={17}
                      color="#171717"
                    />

                    <Text style={styles.profileButtonText}>
                      Acessar meu Perfil
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    onPress={handleSignOut}
                    style={styles.signOutButton}
                  >
                    <MaterialIcons
                      name="logout"
                      size={17}
                      color="#B42318"
                    />

                    <Text style={styles.signOutButtonText}>
                      Sair
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Pesquisa e filtros */}
              <View style={styles.searchBox}>
                <MaterialIcons
                  name="search"
                  size={21}
                  color="#8A8D94"
                />

                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar nome ou e-mail"
                  placeholderTextColor="#93979E"
                  style={styles.searchInput}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Buscar usuários por nome ou e-mail"
                />

                {search.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Limpar pesquisa"
                    onPress={() => setSearch('')}
                    hitSlop={8}
                  >
                    <MaterialIcons
                      name="close"
                      size={19}
                      color="#747982"
                    />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.filtersRow}>
                <FilterChip
                  label="Todos"
                  selected={roleFilter === 'all'}
                  onPress={() => setRoleFilter('all')}
                />

                <FilterChip
                  label="Aluno"
                  selected={roleFilter === 'student'}
                  onPress={() => setRoleFilter('student')}
                />

                <FilterChip
                  label="Professor"
                  selected={roleFilter === 'professor'}
                  onPress={() => setRoleFilter('professor')}
                />

                <FilterChip
                  label={
                    statusFilter === 'all'
                      ? 'Status'
                      : statusFilter === 'active'
                        ? 'Ativos'
                        : 'Inativos'
                  }
                  selected={statusFilter !== 'all'}
                  onPress={openStatusFilter}
                />
              </View>

              <View style={styles.resultsRow}>
                <Text style={styles.resultsCount}>
                  {filteredUsers.length}{' '}
                  {filteredUsers.length === 1
                    ? 'usuário'
                    : 'usuários'}
                </Text>

                {(search ||
                  roleFilter !== 'all' ||
                  statusFilter !== 'all') ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setSearch('');
                      setRoleFilter('all');
                      setStatusFilter('all');
                    }}
                  >
                    <Text style={styles.clearFilters}>
                      Limpar filtros
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.resultsCaption}>
                    Cadastrados
                  </Text>
                )}
              </View>

              {error ? (
                <View style={styles.errorCard}>
                  <MaterialIcons
                    name="error-outline"
                    size={24}
                    color="#B42318"
                  />

                  <Text style={styles.errorText}>{error}</Text>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void loadUsers()}
                  >
                    <Text style={styles.retryText}>
                      Tentar novamente
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {isLoading && users.length === 0 && !error ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator
                    size="large"
                    color="#D0A900"
                  />

                  <Text style={styles.loadingText}>
                    Carregando usuários...
                  </Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <UserCard
              user={item}
              onPress={() =>
                router.push({
                  pathname: '/gestao/detalhes/[userId]',
                  params: { userId: String(item.id) },
                } as never)
              }
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={styles.separator} />
          )}
          ListEmptyComponent={
            !isLoading && !error ? (
              <View style={styles.emptyCard}>
                <MaterialIcons
                  name="person-search"
                  size={34}
                  color="#A3A6AD"
                />

                <Text style={styles.emptyTitle}>
                  Nenhum usuário encontrado
                </Text>

                <Text style={styles.emptyDescription}>
                  Experimente mudar a pesquisa ou os filtros.
                </Text>
              </View>
            ) : null
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.filterChip,
        selected && styles.filterChipSelected,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          selected && styles.filterChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function UserCard({ user, onPress }: { user: CampusUser; onPress: () => void }) {
  const initials =
    `${user.name.trim().charAt(0)}${user.last_name.trim().charAt(0)}`
      .toUpperCase() || 'U';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir detalhes de ${user.name} ${user.last_name}`}
      onPress={onPress}
      style={styles.userCard}
    >
      <View
        style={[
          styles.userAvatar,
          user.role === 'student' && styles.studentAvatar,
        ]}
      >
        {user.profile_picture_url ? (
          <Image
            source={{ uri: user.profile_picture_url }}
            contentFit="cover"
            style={styles.userAvatarImage}
          />
        ) : (
          <Text style={styles.userAvatarText}>{initials}</Text>
        )}
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.userName} numberOfLines={1}>
          {user.name} {user.last_name}
        </Text>

        <Text style={styles.userEmail} numberOfLines={1}>
          {user.email}
        </Text>

        <View style={styles.badgeRow}>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>
              {roleLabel(user.role)}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              user.is_active
                ? styles.statusActive
                : styles.statusInactive,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                user.is_active
                  ? styles.statusActiveText
                  : styles.statusInactiveText,
              ]}
            >
              {user.is_active ? 'ATIVO' : 'INATIVO'}
            </Text>
          </View>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={21} color="#9B9EA5" />
    </Pressable>
  );
}

function roleLabel(role: CampusUser['role']) {
  const labels = {
    admin: 'ADMINISTRADOR',
    professor: 'PROFESSOR',
    student: 'ALUNO',
  };

  return labels[role];
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F4',
  },
  keyboardContainer: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  pageTitle: {
    color: '#171717',
    fontSize: 26,
    fontWeight: '800',
  },
  pageSubtitle: {
    color: '#777B83',
    fontSize: 12,
    marginTop: 3,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E6E8',
    borderRadius: 13,
    borderWidth: 1,
    marginTop: 15,
    padding: 13,
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFCC00',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: '100%',
    height: '100%',
  },
  profileInitials: {
    color: '#171717',
    fontSize: 13,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    color: '#202124',
    fontSize: 13,
    fontWeight: '800',
  },
  profileEmail: {
    color: '#777B83',
    fontSize: 11,
  },
  profileRole: {
    color: '#777B83',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  profileActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 13,
  },
  profileButton: {
    flex: 1,
    minHeight: 39,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: '#FFCC00',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  disabledButton: {
    opacity: 0.5,
  },
  profileButtonText: {
    color: '#171717',
    fontSize: 11,
    fontWeight: '700',
  },
  signOutButton: {
    minHeight: 39,
    paddingHorizontal: 13,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E7B9B6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  signOutButtonText: {
    color: '#B42318',
    fontSize: 12,
    fontWeight: '700',
  },
  profileError: {
    color: '#B42318',
    fontSize: 11,
    marginTop: 8,
  },
  searchBox: {
    minHeight: 45,
    marginTop: 17,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderColor: '#E3E4E6',
    borderWidth: 1,
    borderRadius: 9,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    color: '#202124',
    fontSize: 12,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 12,
  },
  filterChip: {
    minHeight: 30,
    paddingHorizontal: 11,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E3E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipSelected: {
    backgroundColor: '#FFCC00',
    borderColor: '#FFCC00',
  },
  filterChipText: {
    color: '#555A61',
    fontSize: 10,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: '#171717',
  },
  resultsRow: {
    marginTop: 18,
    marginBottom: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsCount: {
    color: '#34373D',
    fontSize: 12,
    fontWeight: '700',
  },
  resultsCaption: {
    color: '#858991',
    fontSize: 10,
  },
  clearFilters: {
    color: '#665400',
    fontSize: 11,
    fontWeight: '700',
  },
  userCard: {
    minHeight: 78,
    paddingHorizontal: 11,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E7E9',
    borderRadius: 11,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E2E5E3',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: '100%',
    height: '100%',
  },
  studentAvatar: {
    backgroundColor: '#FFCC00',
  },
  userAvatarText: {
    color: '#222222',
    fontSize: 11,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    color: '#202124',
    fontSize: 13,
    fontWeight: '800',
  },
  userEmail: {
    color: '#777B83',
    fontSize: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  roleBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#F0F1F2',
  },
  roleBadgeText: {
    color: '#666B73',
    fontSize: 8,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statusActive: {
    backgroundColor: '#E4F5EB',
  },
  statusInactive: {
    backgroundColor: '#FDE9E7',
  },
  statusText: {
    fontSize: 8,
    fontWeight: '800',
  },
  statusActiveText: {
    color: '#21834A',
  },
  statusInactiveText: {
    color: '#B42318',
  },
  separator: {
    height: 7,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 9,
    paddingVertical: 35,
  },
  loadingText: {
    color: '#737780',
    fontSize: 12,
  },
  errorCard: {
    alignItems: 'center',
    gap: 9,
    padding: 15,
    marginTop: 12,
    backgroundColor: '#FDEDEC',
    borderRadius: 11,
  },
  errorText: {
    color: '#8A1C13',
    fontSize: 12,
    textAlign: 'center',
  },
  retryText: {
    color: '#8A1C13',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 25,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
  },
  emptyTitle: {
    color: '#34373D',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyDescription: {
    color: '#777B83',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
});
